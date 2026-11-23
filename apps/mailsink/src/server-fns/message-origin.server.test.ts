import { insertCapturedMessage } from '@mailsink/core/capture-testing'
import { apiLogs, messages, newId, smtpSessions } from '@mailsink/db'
import { createTestWorkspace, describeDb } from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { installTestRuntime } from '../http/test-fixtures'
import { stopRuntime } from '../runtime/boot'
import type { Runtime } from '../runtime/container'
import { readMessageOrigin } from './message-origin.server'

describeDb('message origin (viewer « Payload » toggle)', (ctx) => {
  let runtime: Runtime
  let ws: { id: string; slug: string }
  beforeAll(async () => {
    runtime = await installTestRuntime(ctx.handle)
    ws = await createTestWorkspace(ctx.db)
  })
  afterAll(() => stopRuntime())

  it('finds the API request that created the message, body pretty printed', async () => {
    const { id } = await insertCapturedMessage(ctx.db, ws.id, { subject: 'From API' })
    const logId = newId('req')
    await ctx.db.insert(apiLogs).values({
      id: logId,
      workspaceId: ws.id,
      dialect: 'resend',
      method: 'POST',
      path: '/emails',
      statusCode: 200,
      durationMs: 3,
      requestBody: { from: 'app@x.io', subject: 'From API' },
      messageIds: [id],
    })
    expect(await readMessageOrigin(runtime, ws.slug, id)).toEqual({
      kind: 'api',
      logId,
      dialect: 'resend',
      method: 'POST',
      path: '/emails',
      statusCode: 200,
      createdAt: expect.any(String),
      body: '{\n  "from": "app@x.io",\n  "subject": "From API"\n}',
    })
  })

  it('reads the SMTP envelope of the session that carried the message', async () => {
    const { id } = await insertCapturedMessage(ctx.db, ws.id, { subject: 'From SMTP' })
    await ctx.db.update(messages).set({ source: 'smtp' }).where(eq(messages.id, id))
    const sessionId = newId('smtp')
    await ctx.db.insert(smtpSessions).values({
      id: sessionId,
      workspaceId: ws.id,
      remoteAddress: '127.0.0.1',
      transcript: [
        { at: 0, dir: 'S', line: '220 mailsink ESMTP' },
        { at: 1, dir: 'C', line: 'EHLO app' },
        { at: 2, dir: 'C', line: 'AUTH PLAIN [redacted]' },
        { at: 3, dir: 'C', line: 'MAIL FROM:<app@x.io>' },
        { at: 4, dir: 'C', line: 'RCPT TO:<jane@x.io>' },
        { at: 5, dir: 'C', line: 'DATA' },
      ],
      messageIds: [id],
      outcome: 'accepted',
      startedAt: new Date(),
    })
    expect(await readMessageOrigin(runtime, ws.slug, id)).toEqual({
      kind: 'smtp',
      sessionId,
      startedAt: expect.any(String),
      envelope: ['EHLO app', 'MAIL FROM:<app@x.io>', 'RCPT TO:<jane@x.io>'],
    })
  })

  it('answers null without a log, not_found for an unknown message', async () => {
    const { id } = await insertCapturedMessage(ctx.db, ws.id)
    expect(await readMessageOrigin(runtime, ws.slug, id)).toBeNull()
    await expect(readMessageOrigin(runtime, ws.slug, newId('msg'))).rejects.toMatchObject({
      code: 'not_found',
    })
  })
})
