import { messages, workspaces } from '@mailsink/db'
import { createTestWorkspace, describeDb } from '@mailsink/db/testing'
import { eq, inArray } from 'drizzle-orm'
import { expect, it } from 'vitest'
import { insertCapturedMessage } from '../capture/testing/fixtures'
import { createEventBus, type StreamFrame } from '../events/bus'
import { createActivityTracker } from './activity'
import { runEphemeralGc, startEphemeralGc } from './expiry'

const NOW = Date.UTC(2026, 10, 23, 12, 0, 0)
const TTL = 60

describeDb('ephemeral workspace GC', (ctx) => {
  const ephemeral = (lastActivity: number) =>
    createTestWorkspace(ctx.db, {
      ephemeral: true,
      idleTtlSeconds: TTL,
      lastActivityAt: new Date(lastActivity),
      expiresAt: new Date(lastActivity + TTL * 1000),
    })
  const exists = async (ids: string[]) =>
    (await ctx.db.select().from(workspaces).where(inArray(workspaces.id, ids))).map((w) => w.id)

  it('deletes expired ephemeral workspaces with what they own, and publishes workspace.deleted', async () => {
    const expired = await ephemeral(NOW - (TTL + 1) * 1000)
    const alive = await ephemeral(NOW - 10_000)
    const persistent = await createTestWorkspace(ctx.db, { lastActivityAt: new Date(0) })
    const message = await insertCapturedMessage(ctx.db, expired.id, { subject: 'bye' })
    const bus = createEventBus()
    const seen: StreamFrame[] = []
    bus.subscribe(expired.id, (f) => seen.push(f))
    bus.subscribe(alive.id, (f) => seen.push(f))

    const ids = await runEphemeralGc({ db: ctx.db, bus, now: () => NOW })
    expect(ids).toEqual([expired.id])
    expect(await exists([expired.id, alive.id, persistent.id])).toEqual(
      expect.arrayContaining([alive.id, persistent.id]),
    )
    expect(await exists([expired.id])).toEqual([])
    expect(await ctx.db.select().from(messages).where(eq(messages.id, message.id))).toEqual([])
    expect(seen.map((f) => f.event)).toEqual([
      { type: 'workspace.deleted', workspaceId: expired.id },
    ])
  })

  it('activity extends the lifetime: a touched workspace survives its former expiry', async () => {
    const ws = await ephemeral(NOW - 50_000) // expires at NOW + 10 s
    const clock = { t: NOW - 40_000 }
    const tracker = createActivityTracker({ db: ctx.db, now: () => clock.t })
    await tracker.touch(ws.id) // leading edge: expires at NOW + 20 s
    clock.t = NOW - 30_000
    await tracker.touch(ws.id) // throttled, flushed by the GC pass: NOW + 30 s
    const later = NOW + 25_000
    expect(await runEphemeralGc({ db: ctx.db, activity: tracker, now: () => later })).toEqual([])
    expect(await exists([ws.id])).toEqual([ws.id])
    expect(
      await runEphemeralGc({ db: ctx.db, activity: tracker, now: () => NOW + 31_000 }),
    ).toEqual([ws.id])
    await tracker.stop()
  })

  it('runs on a schedule and stops cleanly', async () => {
    const ws = await ephemeral(Date.now() - (TTL + 5) * 1000)
    const gc = startEphemeralGc({ db: ctx.db, intervalMs: 10, log: { info() {}, error() {} } })
    await expect.poll(() => exists([ws.id]), { timeout: 2_000 }).toEqual([])
    await gc.stop()
    expect(gc.running).toBe(false)
  })
})
