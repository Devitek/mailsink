import { createHmac } from 'node:crypto'
import { WebhookEndpointInput } from '@mailsink/contracts'
import { claimJobs, type Job, jobs, listWebhookAttempts, webhookDeliveries } from '@mailsink/db'
import {
  createTestConnection,
  createTestMessage,
  createTestRecipients,
  createTestWorkspace,
  describeDb,
} from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { Webhook } from 'svix'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { createEventBus, type StreamFrame } from '../events/bus'
import { deliverWebhookHandler } from '../jobs/handlers/deliver-webhook'
import { simulateDeliveryHandler } from '../jobs/handlers/simulate'
import { baselinePlanner } from '../simulation/planner'
import { replayWebhookDelivery } from './deliveries'
import { createWebhookEndpoint } from './endpoints'
import { headerRecord, startTestReceiver, type TestReceiver } from './testing/receiver'

describeDb('webhook fan-out and delivery', (ctx) => {
  let receiver: TestReceiver
  let ws = ''
  let con = ''
  const frames: StreamFrame[] = []
  const bus = createEventBus()
  let clock = Date.parse('2026-11-23T10:00:00Z')
  const deliver = deliverWebhookHandler({ bus, now: () => clock, random: () => 0.5 })
  const signal = new AbortController().signal

  beforeAll(async () => {
    receiver = await startTestReceiver()
  })
  afterAll(() => receiver.close())

  const endpoint = (patch: Record<string, unknown>) =>
    createWebhookEndpoint(
      ctx.db,
      ws,
      WebhookEndpointInput.parse({ connectionId: null, url: receiver.url, ...patch }),
    )
  const runDue = async () => {
    const claimed = await claimJobs(ctx.db, { kinds: ['deliver_webhook'], limit: 50 })
    for (const job of claimed) {
      await deliver(job, { db: ctx.db, signal })
      await ctx.db.delete(jobs).where(eq(jobs.id, job.id))
    }
    return claimed
  }
  const dueNow = () => ctx.db.update(jobs).set({ runAt: new Date(0) })

  beforeEach(async () => {
    await ctx.db.delete(jobs)
    receiver.received.length = 0
    receiver.respondWith(200)
    frames.length = 0
    ws = (await createTestWorkspace(ctx.db)).id
    con = (await createTestConnection(ctx.db, ws)).id
    bus.subscribe(ws, (f) => frames.push(f))
  })

  async function simulate() {
    const msg = await createTestMessage(ctx.db, ws, { connectionId: con, subject: 'Hi' })
    await createTestRecipients(ctx.db, msg, [{ email: 'jane@x.io' }])
    const handler = simulateDeliveryHandler({ planner: baselinePlanner, bus })
    await handler({ workspaceId: ws, payload: { messageId: msg.id } } as Job, {
      db: ctx.db,
      signal,
    })
    return msg
  }

  it('fans out by scope and subscription, never by ingestion channel', async () => {
    const resend = await endpoint({ connectionId: con, events: ['email.delivered'] })
    const unified = await endpoint({ events: ['email.sent', 'email.delivered'] })
    const brevo = await endpoint({ payloadFormat: 'brevo', events: ['request'] })
    const other = await createTestConnection(ctx.db, ws, { name: 'Other' })
    await endpoint({ connectionId: other.id, events: ['email.delivered'] })
    await endpoint({ events: ['email.delivered'], enabled: false })
    const msg = await simulate()

    const rows = await ctx.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.messageId, msg.id))
    const by = (id: string) => rows.filter((r) => r.endpointId === id).map((r) => r.dialectEvent)
    expect(by(resend.id)).toEqual(['email.delivered'])
    expect(by(unified.id).sort()).toEqual(['email.delivered', 'email.sent'])
    expect(by(brevo.id)).toEqual(['request'])
    expect(rows).toHaveLength(4)
    expect(frames.filter((f) => f.event.type === 'webhook.delivery')).toHaveLength(4)

    await runDue()
    expect(receiver.received).toHaveLength(4)
    const svix = receiver.received.find((r) => r.headers['svix-id'])
    expect(svix?.body).toBe(rows.find((r) => r.endpointId === resend.id)?.body)
    const secret = resend.secret ?? ''
    expect(() =>
      new Webhook(secret).verify(svix?.body ?? '', headerRecord(svix?.headers ?? {})),
    ).toThrow() // the svix timestamp is the injected clock, 2026-11-23: too old for svix
    clock = Date.now()
  })

  it('retries with a fresh signature, stores the exact headers and replays', async () => {
    clock = Date.now()
    const resend = await endpoint({ connectionId: con, events: ['email.delivered'] })
    const unified = await endpoint({ events: ['email.delivered'] })
    receiver.respondWith(500, 500, 200)
    await simulate()
    await runDue()
    const [first] = await ctx.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.status, 'retrying'))
    expect(first).toMatchObject({ attemptCount: 1, lastStatusCode: 500 })
    clock += 7_000
    await dueNow()
    await runDue()
    const all = await ctx.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.workspaceId, ws))
    expect(all.map((d) => d.status).sort()).toEqual(['succeeded', 'succeeded'])
    const resendDelivery = all.find((d) => d.endpointId === resend.id)
    const unifiedDelivery = all.find((d) => d.endpointId === unified.id)
    if (!resendDelivery || !unifiedDelivery) throw new Error('missing deliveries')

    const attempts = await listWebhookAttempts(ctx.db, resendDelivery.id)
    expect(attempts.map((a) => a.attemptNo)).toEqual([1, 2])
    expect(attempts[1]?.signedAt).toBe((attempts[0]?.signedAt ?? 0) + 7)
    const last = receiver.received.filter((r) => r.headers['svix-id']).at(-1)
    expect(last?.headers['svix-signature']).toBe(attempts[1]?.requestHeaders['svix-signature'])
    const secret = resend.secret ?? ''
    expect(() =>
      new Webhook(secret).verify(last?.body ?? '', headerRecord(last?.headers ?? {})),
    ).not.toThrow()

    const unifiedAttempt = (await listWebhookAttempts(ctx.db, unifiedDelivery.id)).at(-1)
    const ts = unifiedAttempt?.requestHeaders['X-Mailsink-Timestamp']
    const mac = createHmac('sha256', unified.secret ?? '').update(`${ts}.${unifiedDelivery.body}`)
    expect(unifiedAttempt?.requestHeaders['X-Mailsink-Signature']).toBe(
      `sha256=${mac.digest('hex')}`,
    )

    // exact: same bytes and headers, signature included; resign: same id, fresh timestamp.
    receiver.received.length = 0
    const exact = await replayWebhookDelivery(ctx.db, ws, resendDelivery.id, { mode: 'exact' })
    clock += 60_000
    const resign = await replayWebhookDelivery(ctx.db, ws, exact.id, { mode: 'resign' })
    expect(resign.replayOf).toBe(resendDelivery.id)
    await runDue()
    expect(receiver.received).toHaveLength(2)
    const stamp = (r: (typeof receiver.received)[number]) => Number(r.headers['svix-timestamp'])
    const exactReq = receiver.received.find((r) => stamp(r) === attempts[1]?.signedAt)
    const resignReq = receiver.received.find((r) => r !== exactReq)
    expect(exactReq?.body).toBe(resendDelivery.body)
    expect(exactReq?.headers['svix-signature']).toBe(attempts[1]?.requestHeaders['svix-signature'])
    expect(resignReq?.headers['svix-id']).toBe(resendDelivery.id)
    expect(Number(resignReq?.headers['svix-timestamp'])).toBe(Math.floor(clock / 1000))
    expect(() =>
      new Webhook(secret).verify(resignReq?.body ?? '', headerRecord(resignReq?.headers ?? {})),
    ).not.toThrow()

    // A replayed job (already recorded attempt) sends nothing.
    const before = receiver.received.length
    await deliver({ workspaceId: ws, payload: { deliveryId: exact.id, attemptNo: 1 } } as Job, {
      db: ctx.db,
      signal,
    })
    expect(receiver.received).toHaveLength(before)
  })

  it('gives up after the last attempt', async () => {
    clock = Date.now()
    await endpoint({ events: ['email.delivered'] })
    receiver.respondWith(503)
    const failing = deliverWebhookHandler({ now: () => clock, maxAttempts: 2 })
    await simulate()
    for (let i = 0; i < 2; i++) {
      await dueNow()
      for (const job of await claimJobs(ctx.db, { kinds: ['deliver_webhook'] })) {
        await failing(job, { db: ctx.db, signal })
        await ctx.db.delete(jobs).where(eq(jobs.id, job.id))
      }
    }
    const [row] = await ctx.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.workspaceId, ws))
    expect(row).toMatchObject({ status: 'failed', attemptCount: 2, nextAttemptAt: null })
    expect(await claimJobs(ctx.db, { kinds: ['deliver_webhook'] })).toEqual([])
  })
})
