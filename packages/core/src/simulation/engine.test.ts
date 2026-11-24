import { SimulationSettings, type SimulationSettingsPatch } from '@mailsink/contracts'
import {
  jobs,
  messageEvents,
  messageRecipients,
  messages,
  newId,
  overrides,
  suppressions,
  workspaces,
} from '@mailsink/db'
import { createTestWorkspaceWithConnection, describeDb } from '@mailsink/db/testing'
import { asc, eq } from 'drizzle-orm'
import { beforeEach, expect, it } from 'vitest'
import { simulateDelivery } from './simulate-delivery'
import type { SimulationSnapshot } from './snapshot'
import { insertQueuedMessage } from './testing/fixtures'

describeDb('simulation engine (settings planner)', (ctx) => {
  let workspaceId = ''
  let connectionId = ''
  const T0 = Date.parse('2026-11-23T10:00:00Z')
  const at = (ms: number) => () => T0 + ms

  beforeEach(async () => {
    const seeded = await createTestWorkspaceWithConnection(ctx.db)
    workspaceId = seeded.workspace.id
    connectionId = seeded.connection.id
  })

  const send = (emails: string[]) =>
    insertQueuedMessage(
      ctx.db,
      workspaceId,
      emails.map((email) => ({ email })),
      { connectionId, job: false },
    )
  const setWorkspace = (patch: SimulationSettingsPatch) =>
    ctx.db
      .update(workspaces)
      .set({ simulation: SimulationSettings.parse(patch) })
      .where(eq(workspaces.id, workspaceId))
  const recipientStatuses = async (id: string) =>
    Object.fromEntries(
      (
        await ctx.db
          .select({ email: messageRecipients.email, status: messageRecipients.status })
          .from(messageRecipients)
          .where(eq(messageRecipients.messageId, id))
      ).map((r) => [r.email, r.status]),
    )
  const message = async (id: string) =>
    (await ctx.db.select().from(messages).where(eq(messages.id, id)))[0]
  const pendingJobs = () => ctx.db.select().from(jobs).where(eq(jobs.workspaceId, workspaceId))

  it('applies deterministic rules before the draw, with the SMTP code in the event', async () => {
    await setWorkspace({
      rates: { delivered: 100 },
      rules: [{ match: '*+bounce@*', status: 'hard_bounce', smtpCode: 550 }],
    })
    const id = await send(['a+bounce@x.io', 'b@x.io'])
    const result = await simulateDelivery(ctx.db, id, { now: at(0), seed: 1 })
    expect(result).toMatchObject({ messageStatus: 'hard_bounce', nextRunAt: null })
    expect(await recipientStatuses(id)).toEqual({
      'a+bounce@x.io': 'hard_bounce',
      'b@x.io': 'delivered',
    })
    const events = await ctx.db
      .select()
      .from(messageEvents)
      .where(eq(messageEvents.recipientEmail, 'a+bounce@x.io'))
      .orderBy(asc(messageEvents.id))
    expect(events.map((e) => [e.type, e.data])).toEqual([
      ['sent', null],
      ['hard_bounce', { reason: 'rule *+bounce@*', smtpCode: 550 }],
    ])
  })

  it('applies the rules carried by the message before the stored ones (demo)', async () => {
    await setWorkspace({ rules: [{ match: '*@x.io', status: 'failed' }] })
    const id = await send(['a@x.io', 'b@x.io'])
    await ctx.db
      .update(messages)
      .set({ simulation: { rules: [{ match: 'a@x.io', status: 'complained' }] } })
      .where(eq(messages.id, id))
    await simulateDelivery(ctx.db, id, { now: at(0) })
    expect(await recipientStatuses(id)).toEqual({ 'a@x.io': 'complained', 'b@x.io': 'failed' })
    expect((await message(id))?.simulation).toMatchObject({ rules: [{ match: 'a@x.io' }] })
  })

  it('adds hard_bounce and complained recipients to the suppression list', async () => {
    await setWorkspace({
      rules: [
        { match: 'hb@*', status: 'hard_bounce' },
        { match: 'cp@*', status: 'complained' },
        { match: 'sb@*', status: 'soft_bounce' },
        { match: '*+invalid@*', status: 'invalid' },
      ],
    })
    const id = await send(['hb@x.io', 'cp@x.io', 'sb@x.io', 'jo+invalid@x.io'])
    const result = await simulateDelivery(ctx.db, id, { now: at(0) })
    // An invalid address is not listed, as Brevo blocks only hard bounces and spam (D283).
    expect(result).toMatchObject({ suppressed: ['hb@x.io', 'cp@x.io'] })
    expect((await recipientStatuses(id))['jo+invalid@x.io']).toBe('invalid')
    const rows = await ctx.db
      .select({
        email: suppressions.email,
        reason: suppressions.reason,
        messageId: suppressions.messageId,
      })
      .from(suppressions)
      .where(eq(suppressions.workspaceId, workspaceId))
      .orderBy(asc(suppressions.email))
    expect(rows).toEqual([
      { email: 'cp@x.io', reason: 'complained', messageId: id },
      { email: 'hb@x.io', reason: 'hard_bounce', messageId: id },
    ])
    // Already listed: a second bounce keeps the first row.
    const again = await send(['hb@x.io'])
    expect(await simulateDelivery(ctx.db, again, { now: at(5) })).toMatchObject({ suppressed: [] })
  })

  it('draws reproducibly from an injected seed and stores the decision snapshot', async () => {
    await setWorkspace({ rates: { hard_bounce: 50, deferred: 0 } })
    const emails = Array.from({ length: 20 }, (_, i) => `r${i}@x.io`)
    const first = await send(emails)
    const second = await send(emails)
    await simulateDelivery(ctx.db, first, { now: at(0), seed: 42 })
    await simulateDelivery(ctx.db, second, { now: at(0), seed: 42 })
    const a = await recipientStatuses(first)
    expect(a).toEqual(await recipientStatuses(second))
    const values = Object.values(a)
    expect(values).toContain('hard_bounce')
    expect(values).toContain('delivered')
    const snapshot = (await message(first))?.simulation as unknown as SimulationSnapshot & {
      sources: Record<string, string>
    }
    expect(snapshot.seed).toBe(42)
    expect(snapshot.overrideIds).toEqual({ workspace: null, connection: null })
    expect(snapshot.sources.rates).toBe('workspace')
    expect(snapshot.recipients['r0@x.io']).toMatchObject({
      status: a['r0@x.io'],
      source: 'rates',
      attempt: 0,
      delayMs: 0,
      decidedAt: new Date(T0).toISOString(),
      appliedAt: new Date(T0).toISOString(),
    })
  })

  it('holds recipients in sent for the latency, then a follow-up job applies the final status', async () => {
    await setWorkspace({
      latency: { minMs: 2000, maxMs: 2000 },
      rules: [{ match: 'slow@*', delayMs: 10_000 }],
    })
    const id = await send(['fast@x.io', 'slow@x.io'])
    const first = await simulateDelivery(ctx.db, id, { now: at(0) })
    expect(first).toMatchObject({ messageStatus: 'sent', nextRunAt: new Date(T0 + 2000) })
    expect(await recipientStatuses(id)).toEqual({ 'fast@x.io': 'sent', 'slow@x.io': 'sent' })
    expect((await pendingJobs()).map((j) => j.runAt)).toEqual([new Date(T0 + 2000)])

    expect(await simulateDelivery(ctx.db, id, { now: at(1000) })).toMatchObject({ transitions: [] })
    const second = await simulateDelivery(ctx.db, id, { now: at(2000) })
    expect(second).toMatchObject({ messageStatus: 'sent', nextRunAt: new Date(T0 + 10_000) })
    expect(await recipientStatuses(id)).toEqual({ 'fast@x.io': 'delivered', 'slow@x.io': 'sent' })
    const third = await simulateDelivery(ctx.db, id, { now: at(10_000) })
    expect(third).toMatchObject({ messageStatus: 'delivered', nextRunAt: null })
  })

  it('re-queues deferred recipients, then ends them soft_bounce past the cap', async () => {
    await setWorkspace({ rules: [{ match: 'later@*', status: 'deferred' }] })
    const id = await send(['later@x.io'])
    let now = 0
    const r0 = await simulateDelivery(ctx.db, id, { now: at(now), deferredRetryMs: 100 })
    expect(r0).toMatchObject({ messageStatus: 'deferred', nextRunAt: new Date(T0 + 100) })
    for (let i = 0; i < 3; i++) {
      now += 100
      await simulateDelivery(ctx.db, id, { now: at(now), deferredRetryMs: 100 })
    }
    expect(await recipientStatuses(id)).toEqual({ 'later@x.io': 'soft_bounce' })
    const types = (
      await ctx.db
        .select({ type: messageEvents.type })
        .from(messageEvents)
        .where(eq(messageEvents.messageId, id))
        .orderBy(asc(messageEvents.id))
    ).map((e) => e.type)
    expect(types).toEqual(['sent', 'deferred', 'deferred', 'deferred', 'soft_bounce'])
    expect((await message(id))?.status).toBe('soft_bounce')
  })

  it('lets a deferred recipient be delivered once the override is gone', async () => {
    const ovr = newId('ovr')
    await ctx.db.insert(overrides).values({
      id: ovr,
      workspaceId,
      connectionId,
      config: { rates: { deferred: 100 } },
      activatedVia: 'api',
    })
    const id = await send(['a@x.io'])
    await simulateDelivery(ctx.db, id, { now: at(0), deferredRetryMs: 50 })
    expect((await message(id))?.simulation).toMatchObject({
      overrideIds: { workspace: null, connection: ovr },
      sources: { rates: 'connection_override' },
    })
    expect(await recipientStatuses(id)).toEqual({ 'a@x.io': 'deferred' })
    // Each retry is decided again with the settings of its decision time.
    await simulateDelivery(ctx.db, id, { now: at(50), deferredRetryMs: 50 })
    expect(await recipientStatuses(id)).toEqual({ 'a@x.io': 'deferred' })
    await ctx.db.update(overrides).set({ resetAt: new Date() }).where(eq(overrides.id, ovr))
    await simulateDelivery(ctx.db, id, { now: at(100), deferredRetryMs: 50 })
    await simulateDelivery(ctx.db, id, { now: at(150), deferredRetryMs: 50 })
    expect(await recipientStatuses(id)).toEqual({ 'a@x.io': 'delivered' })
  })
})
