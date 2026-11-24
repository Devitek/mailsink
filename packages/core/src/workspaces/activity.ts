import { type Database, touchWorkspaceActivity } from '@mailsink/db'

/** One activity write per workspace per window at most (D16). */
export const ACTIVITY_THROTTLE_MS = 15_000

export interface ActivityTrackerOptions {
  db: Database
  throttleMs?: number
  now?: () => number
  log?: Pick<Console, 'warn'>
}

/**
 * Workspace activity (D16, D81). `touch` writes at once when the workspace was
 * not written during the last window (leading edge), otherwise remembers the latest time
 * and writes it when the window closes (trailing edge). So there is at most one write per
 * workspace per window, and `expires_at` never lags behind the real last activity once the
 * window closed. `flush` writes every pending time now (GC pass, shutdown) and waits for
 * the writes a closing window already started.
 */
export interface ActivityTracker {
  touch(workspaceId: string): Promise<void>
  flush(): Promise<void>
  /** Drops the state of a deleted workspace. */
  forget(workspaceId: string): void
  /** Flushes, then stops the timers. */
  stop(): Promise<void>
}

type Slot = { windowEndsAt: number; pending?: number; timer?: ReturnType<typeof setTimeout> }

export function createActivityTracker(options: ActivityTrackerOptions): ActivityTracker {
  const { db, throttleMs = ACTIVITY_THROTTLE_MS, now = Date.now, log = console } = options
  const slots = new Map<string, Slot>()
  /** Writes started by a window timer, which nobody awaits: `flush` waits for them. */
  const inflight = new Set<Promise<void>>()

  async function write(workspaceId: string, at: number): Promise<void> {
    try {
      await touchWorkspaceActivity(db, workspaceId, new Date(at))
    } catch (error) {
      log.warn(`[mailsink] activity: touch of ${workspaceId} failed: ${String(error)}`)
    }
  }

  async function flushOne(workspaceId: string): Promise<void> {
    const slot = slots.get(workspaceId)
    if (!slot) return
    if (slot.timer) clearTimeout(slot.timer)
    slot.timer = undefined
    const at = slot.pending
    slot.pending = undefined
    if (at === undefined) {
      slots.delete(workspaceId) // window over and nothing to write: forget it
      return
    }
    slot.windowEndsAt = now() + throttleMs
    slot.timer = schedule(workspaceId)
    await write(workspaceId, at)
  }

  function schedule(workspaceId: string) {
    const timer = setTimeout(() => {
      const running = flushOne(workspaceId).finally(() => inflight.delete(running))
      inflight.add(running)
    }, throttleMs)
    timer.unref?.()
    return timer
  }

  async function flush(): Promise<void> {
    const pending = [...slots].filter(([, s]) => s.pending !== undefined).map(([id]) => id)
    await Promise.all([...pending.map(flushOne), ...inflight])
  }

  return {
    flush,
    async touch(workspaceId) {
      const at = now()
      const slot = slots.get(workspaceId)
      if (slot && at < slot.windowEndsAt) {
        slot.pending = Math.max(slot.pending ?? 0, at)
        return
      }
      if (slot?.timer) clearTimeout(slot.timer)
      slots.set(workspaceId, { windowEndsAt: at + throttleMs, timer: schedule(workspaceId) })
      await write(workspaceId, at)
    },
    forget(workspaceId) {
      const slot = slots.get(workspaceId)
      if (slot?.timer) clearTimeout(slot.timer)
      slots.delete(workspaceId)
    },
    async stop() {
      await flush()
      for (const slot of slots.values()) if (slot.timer) clearTimeout(slot.timer)
      slots.clear()
    },
  }
}
