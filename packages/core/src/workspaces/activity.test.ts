import { workspaces } from '@mailsink/db'
import { createTestWorkspace, describeDb } from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'
import { createActivityTracker } from './activity'

const T0 = Date.now() - 3_600_000
const TTL = 60

describeDb('workspace activity tracking (D16)', (ctx) => {
  const ephemeral = () =>
    createTestWorkspace(ctx.db, {
      ephemeral: true,
      idleTtlSeconds: TTL,
      lastActivityAt: new Date(T0),
      expiresAt: new Date(T0 + TTL * 1000),
    })
  const read = async (id: string) => {
    const [row] = await ctx.db.select().from(workspaces).where(eq(workspaces.id, id))
    return { last: row?.lastActivityAt.getTime(), expires: row?.expiresAt?.getTime() ?? null }
  }
  const clock = (start: number) => {
    const c = { t: start, now: () => c.t }
    return c
  }

  it('writes at once, then at most once per window, keeping expires_at in sync', async () => {
    const ws = await ephemeral()
    const c = clock(T0 + 1_000)
    const tracker = createActivityTracker({ db: ctx.db, throttleMs: 15_000, now: c.now })
    await tracker.touch(ws.id)
    expect(await read(ws.id)).toEqual({ last: c.t, expires: c.t + TTL * 1000 })

    c.t = T0 + 5_000
    await tracker.touch(ws.id)
    expect((await read(ws.id)).last).toBe(T0 + 1_000) // throttled
    c.t = T0 + 9_000
    await tracker.touch(ws.id)
    await tracker.flush() // trailing edge: the latest throttled time
    expect(await read(ws.id)).toEqual({ last: T0 + 9_000, expires: T0 + 9_000 + TTL * 1000 })
    await tracker.stop()
  })

  // The window closes on a real timer; the clock is injected so the trailing time differs
  // from the leading one, and the read waits for the timer's write instead of sleeping a
  // fixed delay that a loaded runner could outlast (#153).
  it('writes the trailing touch when the window closes', async () => {
    const ws = await ephemeral()
    const c = clock(T0 + 1_000)
    const tracker = createActivityTracker({ db: ctx.db, throttleMs: 40, now: c.now })
    await tracker.touch(ws.id)
    c.t = T0 + 1_005
    await tracker.touch(ws.id)
    expect((await read(ws.id)).last).toBe(T0 + 1_000) // throttled until the window closes
    await vi.waitFor(async () => expect((await read(ws.id)).last).toBe(T0 + 1_005), {
      timeout: 5_000,
      interval: 20,
    })
    expect((await read(ws.id)).expires).toBe(T0 + 1_005 + TTL * 1000)
    await tracker.stop()
  })

  it('keeps expires_at null on a persistent workspace and never moves time back', async () => {
    const ws = await createTestWorkspace(ctx.db, { lastActivityAt: new Date(T0) })
    const c = clock(T0 + 2_000)
    const tracker = createActivityTracker({ db: ctx.db, now: c.now })
    await tracker.touch(ws.id)
    expect(await read(ws.id)).toEqual({ last: T0 + 2_000, expires: null })
    tracker.forget(ws.id)
    c.t = T0 + 1_000 // older than the stored activity
    await tracker.touch(ws.id)
    expect((await read(ws.id)).last).toBe(T0 + 2_000)
    await tracker.stop()
  })

  it('logs instead of failing when the write fails', async () => {
    const warn: string[] = []
    const broken = {
      update: () => {
        throw new Error('down')
      },
    } as never
    const tracker = createActivityTracker({ db: broken, log: { warn: (m) => warn.push(m) } })
    await expect(tracker.touch('ws_x')).resolves.toBeUndefined()
    expect(warn[0]).toContain('ws_x')
    await tracker.stop()
  })
})

describe('workspace activity tracking, shutdown', () => {
  const clock = (start: number) => {
    const c = { t: start, now: () => c.t }
    return c
  }

  it('waits on stop for a trailing write already running', async () => {
    const writes: { at: Date; done: () => void }[] = []
    const slow = {
      update: () => ({
        set: (values: { lastActivityAt: Date }) => ({
          where: () => ({
            returning: () =>
              new Promise<unknown[]>((resolve) => {
                writes.push({ at: values.lastActivityAt, done: () => resolve([]) })
              }),
          }),
        }),
      }),
    } as never
    const c = clock(T0)
    const tracker = createActivityTracker({ db: slow, throttleMs: 10, now: c.now })
    const leading = tracker.touch('ws_x')
    writes[0]?.done()
    await leading
    c.t = T0 + 5
    await tracker.touch('ws_x')
    await vi.waitFor(() => expect(writes).toHaveLength(2)) // the timer started the write
    let stopped = false
    const stopping = tracker.stop().then(() => {
      stopped = true
    })
    await new Promise((r) => setTimeout(r, 20))
    expect(stopped).toBe(false)
    writes[1]?.done()
    await stopping
    expect(writes.map((w) => w.at.getTime())).toEqual([T0, T0 + 5])
  })
})
