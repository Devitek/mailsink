import { SendEmailRequest } from '@mailsink/contracts'
import { type Job, jobs } from '@mailsink/db'
import { createTestSuppression, describeDb } from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { beforeEach, expect, it } from 'vitest'
import { sendNativeBatch, sendNativeEmail } from '../ingestion/native'
import type { IngestTarget } from '../ingestion/normalize'
import { sampleRequest, seedTarget } from '../ingestion/testing/fixtures'
import { simulateDeliveryHandler } from '../jobs/handlers/simulate'
import { createEventBus, type EventBus, type StreamFrame } from './bus'
import { replayFrames } from './replay'

describeDb('event publication: ingestion, simulation and replay', (ctx) => {
  let target: IngestTarget
  let bus: EventBus
  let seen: StreamFrame[]

  beforeEach(async () => {
    target = await seedTarget(ctx.db)
    bus = createEventBus()
    seen = []
    bus.subscribe(target.workspaceId, (f) => seen.push(f))
  })

  const deps = () => ({ db: ctx.db, maxMessageBytes: 1 << 20, bus })
  const send = (patch = {}, key?: string) =>
    sendNativeEmail(deps(), target, SendEmailRequest.parse(sampleRequest(patch)), key)
  const simulate = async () => {
    const pending = await ctx.db.select().from(jobs).where(eq(jobs.workspaceId, target.workspaceId))
    for (const job of pending) {
      await simulateDeliveryHandler({ bus })(job as Job, {
        db: ctx.db,
        signal: new AbortController().signal,
      })
      await ctx.db.delete(jobs).where(eq(jobs.id, job.id))
    }
  }

  it('publishes message.created once committed, with the accepted event id', async () => {
    const { response } = await send({ subject: 'Hello', tags: [{ name: 'k', value: 'v' }] })
    const id = (response.body as { id: string }).id
    expect(seen).toHaveLength(1)
    const [frame] = seen
    expect(frame?.id).toMatch(/^evt_/)
    expect(frame?.connectionId).toBe(target.connectionId)
    expect(frame?.event).toEqual({
      type: 'message.created',
      message: expect.objectContaining({
        id,
        subject: 'Hello',
        status: 'queued',
        to: [{ email: 'jane@x.io', name: null }],
        tags: [{ name: 'k', value: 'v' }],
        hasAttachments: false,
      }),
    })
  })

  it('publishes nothing for an idempotent replay', async () => {
    await send({}, 'same-key')
    await send({}, 'same-key')
    expect(seen).toHaveLength(1)
  })

  it('publishes one message.event per suppressed recipient, and every batch item', async () => {
    await createTestSuppression(ctx.db, target.workspaceId, 'gone@x.io')
    await sendNativeBatch(deps(), target, [
      sampleRequest({ to: ['jane@x.io', 'gone@x.io'] }),
      sampleRequest({ to: 'bob@x.io' }),
    ])
    expect(seen.map((f) => f.event.type)).toEqual([
      'message.created',
      'message.event',
      'message.created',
    ])
    expect(seen[1]?.event).toMatchObject({
      messageId: (seen[0]?.event as { message: { id: string } }).message.id,
      event: { type: 'suppressed', recipient: 'gone@x.io', data: { reason: expect.any(String) } },
    })
  })

  it('publishes the simulation rows, then the aggregated status', async () => {
    await send({ to: ['a@x.io', 'b@x.io'] })
    seen.length = 0
    await simulate()
    expect(seen.map((f) => [f.event.type, f.id === null])).toEqual([
      ['message.event', false],
      ['message.event', false],
      ['message.event', false],
      ['message.event', false],
      ['message.status', true],
    ])
    expect(seen.at(-1)?.event).toMatchObject({ status: 'delivered', recipient: null })
  })

  it('skips the queries when nobody listens', async () => {
    const quiet = createEventBus()
    await sendNativeEmail(
      { ...deps(), bus: quiet },
      target,
      SendEmailRequest.parse(sampleRequest()),
    )
    const pending = await ctx.db.select().from(jobs).where(eq(jobs.workspaceId, target.workspaceId))
    for (const job of pending) {
      await simulateDeliveryHandler({ bus: quiet })(job as Job, {
        db: ctx.db,
        signal: new AbortController().signal,
      })
    }
    expect(quiet.hasSubscribers(target.workspaceId)).toBe(false)
  })

  it('replays after a Last-Event-ID exactly the frames published live', async () => {
    await send({ subject: 'one' })
    await send({ subject: 'two' })
    await simulate()
    const live = seen.filter((f) => f.id !== null)
    const first = live[0]?.id ?? ''
    const replayed = await replayFrames(ctx.db, target.workspaceId, first)
    expect(replayed.map((f) => f.id)).toEqual(live.slice(1).map((f) => f.id))
    expect(replayed.map((f) => f.event.type)).toEqual(live.slice(1).map((f) => f.event.type))
    // Simulation frames are built from the rows the run returns (D95): same as stored.
    const events = (frames: StreamFrame[]) =>
      frames.filter((f) => f.event.type === 'message.event').map((f) => [f.event, f.connectionId])
    expect(events(replayed)).toEqual(events(live.slice(1)))
    expect(await replayFrames(ctx.db, target.workspaceId, first, 2)).toHaveLength(2)
  })

  it('replays nothing for an unknown id or another workspace id', async () => {
    await send()
    const id = seen[0]?.id ?? ''
    const other = await seedTarget(ctx.db)
    expect(await replayFrames(ctx.db, target.workspaceId, 'evt_missing')).toEqual([])
    expect(await replayFrames(ctx.db, other.workspaceId, id)).toEqual([])
  })
})
