import { apiLogs, messages, smtpSessions } from '@mailsink/db'
import { createTestConnection, createTestWorkspace, describeDb } from '@mailsink/db/testing'
import { asc, eq } from 'drizzle-orm'
import { expect, it } from 'vitest'
import { createEventBus, type StreamFrame } from '../events/bus'
import { seedDemoMessages } from './seed'

const NOW = new Date('2026-11-23T10:00:00Z')

// Demo messages come with the log line of the request (or SMTP session) that would have
// created them, so « See in the logs » and the logs explorer work on the demo too (#118).
describeDb('demo logs', (ctx) => {
  const bus = createEventBus()
  const deps = () => ({ db: ctx.db, maxMessageBytes: 1024 * 1024, bus })

  it('logs each message as a request of its dialect or an SMTP session', async () => {
    const ws = (await createTestWorkspace(ctx.db)).id
    const resend = await createTestConnection(ctx.db, ws)
    const smtp = await createTestConnection(ctx.db, ws, {
      name: 'SMTP',
      kind: 'smtp',
      smtpUsername: 'demo-user',
      smtpPasswordHash: 'x',
    })
    const frames: StreamFrame[] = []
    const off = bus.subscribe(ws, (frame) => frames.push(frame))
    const { messageIds } = await seedDemoMessages(deps(), ws, 'en', NOW)
    off()
    const rows = await ctx.db
      .select()
      .from(messages)
      .where(eq(messages.workspaceId, ws))
      .orderBy(asc(messages.createdAt))
    const api = await ctx.db.select().from(apiLogs).where(eq(apiLogs.workspaceId, ws))
    const sessions = await ctx.db
      .select()
      .from(smtpSessions)
      .where(eq(smtpSessions.workspaceId, ws))
    expect(api).toHaveLength(4)
    expect(sessions).toHaveLength(4)
    for (const message of rows) {
      if (message.source === 'smtp') {
        const session = sessions.find((s) => s.messageIds?.includes(message.id))
        expect(session).toMatchObject({ connectionId: smtp.id, outcome: 'accepted' })
        expect(session?.startedAt.getTime()).toBe(message.createdAt.getTime())
        expect(session?.transcript.map((l) => l.line)).toContain(
          `MAIL FROM:<${message.from.email}>`,
        )
        continue
      }
      const log = api.find((l) => l.messageIds?.includes(message.id))
      expect(log).toMatchObject({
        connectionId: resend.id,
        dialect: 'resend',
        method: 'POST',
        path: '/emails',
        statusCode: 200,
        responseBody: { id: message.providerMessageId },
      })
      expect(log?.createdAt.getTime()).toBe(message.createdAt.getTime())
      expect(log?.requestBody).toMatchObject({ subject: message.subject })
    }
    expect(messageIds).toHaveLength(8)
    expect(frames.filter((f) => f.event.type === 'log.api')).toHaveLength(4)
    expect(frames.filter((f) => f.event.type === 'log.smtp')).toHaveLength(4)
  })

  it('logs native requests when the workspace has no connection', async () => {
    const ws = (await createTestWorkspace(ctx.db)).id
    await seedDemoMessages(deps(), ws, 'fr', NOW)
    const api = await ctx.db.select().from(apiLogs).where(eq(apiLogs.workspaceId, ws))
    expect(api).toHaveLength(8)
    expect(new Set(api.map((l) => `${l.dialect} ${l.path} ${l.connectionId}`))).toEqual(
      new Set(['native /v1/emails null']),
    )
  })
})
