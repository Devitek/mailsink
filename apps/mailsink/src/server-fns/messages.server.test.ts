import type { StreamFrame } from '@mailsink/core'
import { insertCapturedMessage } from '@mailsink/core/capture-testing'
import { apiLogs, newId } from '@mailsink/db'
import { createTestWorkspaceWithConnection, describeDb } from '@mailsink/db/testing'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { installTestRuntime } from '../http/test-fixtures'
import { stopRuntime } from '../runtime/boot'
import type { Runtime } from '../runtime/container'
import { triggerUiEvent } from './events.server'
import {
  purgeInbox,
  readFacets,
  readInboxPage,
  readMessage,
  readPreviews,
  readRawSource,
  workspaceOfSlug,
} from './messages.server'

describeDb('UI inbox server functions', (ctx) => {
  let runtime: Runtime
  let ws: { id: string; slug: string }
  let con: string

  beforeAll(async () => {
    runtime = await installTestRuntime(ctx.handle)
    const seeded = await createTestWorkspaceWithConnection(ctx.db)
    ws = seeded.workspace
    con = seeded.connection.id
  })
  afterAll(() => stopRuntime())

  const frames = () => {
    const seen: StreamFrame[] = []
    const stop = runtime.bus.subscribe(ws.id, (f) => seen.push(f))
    return { seen, stop }
  }

  it('resolves workspaces by slug only', async () => {
    expect((await workspaceOfSlug(runtime, ws.slug)).id).toBe(ws.id)
    await expect(workspaceOfSlug(runtime, ws.id)).rejects.toMatchObject({ code: 'not_found' })
  })

  it('lists, filters and counts the inbox of the workspace', async () => {
    const booking = await insertCapturedMessage(ctx.db, ws.id, {
      connectionId: con,
      subject: 'Booking confirmed',
      text: 'See you at 18:00',
      to: ['julie@gmail.test'],
      tags: [{ name: 'category', value: 'booking' }],
    })
    await insertCapturedMessage(ctx.db, ws.id, { subject: 'Invoice', status: 'hard_bounce' })

    const all = await readInboxPage(runtime, ws.slug, {})
    expect(all.data.map((m) => m.subject)).toEqual(['Invoice', 'Booking confirmed'])
    expect(all.data[1]?.preview).toBe('See you at 18:00')
    const subjects = async (filters: Parameters<typeof readInboxPage>[2]) =>
      (await readInboxPage(runtime, ws.slug, filters)).data.map((m) => m.subject)
    expect(await subjects({ q: '@gmail.test' })).toEqual(['Booking confirmed'])
    expect(await subjects({ q: 'invoice' })).toEqual(['Invoice'])
    expect(await subjects({ status: 'hard_bounce' })).toEqual(['Invoice'])
    expect(await subjects({ connectionId: con, tag: 'category:booking' })).toEqual([
      'Booking confirmed',
    ])
    expect(await readPreviews(runtime, ws.slug, [booking.id])).toEqual({
      [booking.id]: 'See you at 18:00',
    })

    const facets = await readFacets(runtime, ws.slug)
    expect(facets).toMatchObject({ total: 2, byStatus: { delivered: 1, hard_bounce: 1 } })
    expect(facets.connections).toEqual([{ id: con, name: 'Resend', kind: 'resend', count: 1 }])
  })

  it('reads a message with session download URLs and its raw source', async () => {
    const { id, attachmentIds } = await insertCapturedMessage(ctx.db, ws.id, {
      raw: 'Subject: Hi\r\n\r\nHello',
      metadata: { userId: 'u_1' },
      attachments: [{ filename: 'a.pdf', contentType: 'application/pdf', content: '%PDF' }],
    })
    const message = await readMessage(runtime, ws.slug, id)
    expect(message.rawUrl).toBe(`/w/${ws.slug}/m/${id}/raw`)
    expect(message.attachments[0]?.downloadUrl).toBe(
      `/w/${ws.slug}/m/${id}/attachments/${attachmentIds[0]}`,
    )
    expect(message).not.toHaveProperty('metadata')
    expect(await readRawSource(runtime, ws.slug, id)).toEqual({
      text: 'Subject: Hi\r\n\r\nHello',
      sizeBytes: 20,
      truncated: false,
    })

    const bare = await insertCapturedMessage(ctx.db, ws.id, {})
    expect(await readRawSource(runtime, ws.slug, bare.id)).toBeNull()
    await expect(readRawSource(runtime, ws.slug, 'msg_missing')).rejects.toMatchObject({
      code: 'not_found',
    })
  })

  it('simulates events with origin ui and publishes them', async () => {
    const { id } = await insertCapturedMessage(ctx.db, ws.id, { to: ['a@x.test', 'b@x.test'] })
    const { seen, stop } = frames()
    const opened = await triggerUiEvent(runtime, ws.slug, id, { type: 'opened' })
    expect(opened.events.map((e) => [e.type, e.origin])).toEqual([
      ['opened', 'ui'],
      ['opened', 'ui'],
    ])
    await triggerUiEvent(runtime, ws.slug, id, { type: 'status', status: 'hard_bounce' })
    stop()
    expect(seen.map((f) => f.event.type)).toEqual([
      'message.event',
      'message.event',
      'message.event',
      'message.event',
      'message.status',
    ])
    expect((await readMessage(runtime, ws.slug, id)).status).toBe('hard_bounce')
  })

  it('purges the messages, keeps the logs and tells the listeners', async () => {
    await ctx.db.insert(apiLogs).values({
      id: newId('req'),
      workspaceId: ws.id,
      dialect: 'native',
      method: 'POST',
      path: '/v1/emails',
      statusCode: 200,
      durationMs: 1,
    })
    const before = await readFacets(runtime, ws.slug)
    const { seen, stop } = frames()
    const purged = await purgeInbox(runtime, ws.slug)
    stop()
    expect(purged.count).toBe(before.total)
    expect(seen.map((f) => f.event)).toEqual([{ type: 'messages.purged', count: before.total }])
    const after = await readFacets(runtime, ws.slug)
    expect(after.total).toBe(0)
    expect(after.logs).toBe(before.logs)
  })
})
