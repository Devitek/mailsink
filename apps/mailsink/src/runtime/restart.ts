import { type BootOptions, bootRuntime, stopRuntime } from './boot'
import type { Runtime } from './container'
import { type PendingRestart, runtimeSlot } from './slot'

/**
 * One edit makes Vite re-evaluate the Nitro plugin more than once (one `full-reload` per
 * environment, measured 100 to 300 ms apart): restarts requested within this window
 * coalesce into one.
 */
export const RESTART_DEBOUNCE_MS = 500

/**
 * Stops the running runtime, then boots a new one from the current code. Requests arriving
 * meanwhile wait for the new runtime (slot.ts). Restarts requested during a restart run
 * after it, so the last evaluated code always wins.
 */
export function restartRuntime(options: BootOptions = {}): Promise<Runtime> {
  const slot = runtimeSlot()
  const previous = slot.restarting?.catch(() => {}) ?? Promise.resolve()
  const restarting = previous.then(async () => {
    await stopRuntime()
    return bootRuntime(options)
  })
  slot.restarting = restarting
  const settle = () => {
    if (slot.restarting === restarting) slot.restarting = undefined
  }
  restarting.then(settle, settle)
  return restarting
}

/**
 * Debounced restartRuntime: calls within `debounceMs` of each other share one restart,
 * run with the options of the last call (the latest evaluated code).
 */
export function requestRestart(
  options: BootOptions = {},
  debounceMs: number = RESTART_DEBOUNCE_MS,
): Promise<Runtime> {
  const slot = runtimeSlot()
  const pending = slot.pendingRestart ?? createPending(debounceMs)
  pending.options = options
  pending.arm()
  return pending.done
}

function createPending(debounceMs: number): PendingRestart {
  const slot = runtimeSlot()
  let resolve!: (runtime: Runtime) => void
  let reject!: (error: unknown) => void
  let timer: ReturnType<typeof setTimeout> | undefined
  const pending: PendingRestart = {
    options: {},
    done: new Promise<Runtime>((res, rej) => {
      resolve = res
      reject = rej
    }),
    arm() {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (slot.pendingRestart === pending) slot.pendingRestart = undefined
        restartRuntime(pending.options).then(resolve, reject)
      }, debounceMs)
    },
  }
  slot.pendingRestart = pending
  return pending
}

/** Resolves once no restart is pending or in flight, so a final stop is not followed by a boot. */
export async function whenRestartSettled(): Promise<void> {
  const current = () => runtimeSlot().pendingRestart?.done ?? runtimeSlot().restarting
  let waited = current()
  while (waited) {
    await waited.catch(() => {})
    const next = current()
    if (next === waited) return
    waited = next
  }
}

/**
 * `restart`: false for the first boot; `'scheduled'` when this evaluation opened a restart;
 * `'coalesced'` when it joined one already waiting for its debounce window (Vite evaluates
 * the plugin once per environment for one edit), so the caller logs each restart once.
 */
export type PluginStart = { restart: false | 'scheduled' | 'coalesced'; ready: Promise<Runtime> }

/**
 * Called by nitro-plugin.ts each time it is evaluated. The first evaluation of the process
 * boots the runtime. A later one only happens in `vite dev`: Vite re-evaluates the plugin
 * when a module it imports changes (runtime/*, packages/core, db, smtp...), and the new
 * code must replace the running runtime, so it restarts.
 */
export function startRuntimeFromPlugin(
  options: BootOptions = {},
  debounceMs: number = RESTART_DEBOUNCE_MS,
): PluginStart {
  const slot = runtimeSlot()
  if (!slot.started) {
    slot.started = true
    return { restart: false, ready: bootRuntime(options) }
  }
  const restart = slot.pendingRestart ? 'coalesced' : 'scheduled'
  return { restart, ready: requestRestart(options, debounceMs) }
}
