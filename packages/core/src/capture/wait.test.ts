import { ListMessagesQuery } from '@mailsink/contracts'
import { messages } from '@mailsink/db'
import { createTestWorkspace, describeDb } from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { beforeEach, expect, it } from 'vitest'
import { createEventBus, type EventBus } from '../events/bus'
import { statusFrame } from '../events/frames'
import { insertCapturedMessage } from './testing/fixtures'
import { waitForMessages } from './wait'

describeDb('capture wait=true (long polling)', (ctx) => {
  let ws: string
  let bus: EventBus
  beforeEach(async () => {
    ws = (await createTestWorkspace(ctx.db)).id
    bus = createEventBus()
  })
  const wait = (q: Record<string, unknown>, signal?: AbortSignal) =>
    waitForMessages(
      { db: ctx.db, bus, signal },
      ws,
      ListMessagesQuery.parse({ wait: 'true', ...q }),
    )
  const ping = (messageId = 'msg_x') => bus.publish(ws, statusFrame(messageId, 'delivered', null))

  it('answers at once when a message already matches since', async () => {
    const m = await insertCapturedMessage(ctx.db, ws, { createdAt: new Date(Date.now() - 60_000) })
    const page = await wait({ since: new Date(Date.now() - 120_000).toISOString(), timeout: 0 })
    expect(page.data.map((d) => d.id)).toEqual([m.id])
  })

  it('ignores messages created before the request when since is absent', async () => {
    await insertCapturedMessage(ctx.db, ws, { createdAt: new Date(Date.now() - 1_000) })
    await expect(wait({ timeout: 50 })).rejects.toMatchObject({ code: 'wait_timeout', status: 408 })
  })

  it('resolves when a matching message is published, subscribing before the query', async () => {
    const pending = wait({ subject: 'otp', timeout: 5_000 })
    // Committed before any notification: the subscription taken first catches the ping.
    await insertCapturedMessage(ctx.db, ws, { subject: 'not it', createdAt: new Date() })
    ping()
    const m = await insertCapturedMessage(ctx.db, ws, {
      subject: 'Your otp',
      createdAt: new Date(),
    })
    ping()
    expect((await pending).data.map((d) => d.id)).toEqual([m.id])
  })

  it('wakes on a status change matching the status filter', async () => {
    const since = new Date(Date.now() - 1_000).toISOString()
    const m = await insertCapturedMessage(ctx.db, ws, { status: 'queued', createdAt: new Date() })
    const pending = wait({ status: 'delivered', since, timeout: 5_000 })
    await new Promise((r) => setTimeout(r, 20))
    await ctx.db.update(messages).set({ status: 'delivered' }).where(eq(messages.id, m.id))
    ping(m.id)
    expect((await pending).data.map((d) => d.status)).toEqual(['delivered'])
  })

  it('answers 404 when the workspace is deleted, and stops on abort', async () => {
    const gone = wait({ timeout: 5_000 })
    bus.publish(ws, {
      id: null,
      connectionId: null,
      event: { type: 'workspace.deleted', workspaceId: ws },
    })
    await expect(gone).rejects.toMatchObject({ code: 'not_found' })

    const controller = new AbortController()
    const aborted = wait({ timeout: 5_000 }, controller.signal)
    controller.abort()
    await expect(aborted).rejects.toMatchObject({ code: 'wait_timeout' })
    expect(bus.hasSubscribers(ws)).toBe(false)
  })
})
