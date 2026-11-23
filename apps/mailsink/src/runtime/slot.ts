import { AsyncLocalStorage } from 'node:async_hooks'
import type { BootOptions } from './boot'
import type { Runtime } from './container'

/**
 * The runtime slot lives on globalThis, not in module scope: Vite HMR re-evaluates modules,
 * and the production build emits two bundles (Nitro plugin and SSR server entry) that must
 * see the same runtime. This module has no runtime dependency so the SSR bundle can import it
 * without pulling smtp-server in a second time.
 */
const SLOT_KEY = Symbol.for('mailsink.runtime')

/** A dev restart waiting for its debounce window (restart.ts requestRestart). */
export type PendingRestart = {
  options: BootOptions
  done: Promise<Runtime>
  /** (Re)starts the debounce timer. */
  arm: () => void
}

export type RuntimeSlot = {
  booting?: Promise<Runtime>
  stopping?: Promise<void>
  /** A dev restart in flight (restart.ts): requests wait for the new runtime. */
  restarting?: Promise<Runtime>
  pendingRestart?: PendingRestart
  /** Set once the Nitro plugin started a runtime in this process (restart.ts). */
  started?: boolean
  /** SIGTERM/SIGINT handlers are installed once per process, not once per boot. */
  shutdownHooks?: boolean
  /** Waiters of the next completed stop (shutdown.ts waits for the Nitro close hook). */
  onStopped?: Array<() => void>
  /** Runtime each request in flight runs against (withRuntime). */
  lease?: AsyncLocalStorage<Runtime>
  /** Requests in flight and the restarts waiting for them to end (restart.ts). */
  inFlight?: { count: number; idle: Array<() => void> }
}

export function runtimeSlot(): RuntimeSlot {
  const holder = globalThis as typeof globalThis & { [SLOT_KEY]?: RuntimeSlot }
  holder[SLOT_KEY] ??= {}
  return holder[SLOT_KEY]
}

/**
 * Resolves once the runtime booted by the Nitro plugin is ready (used per request). Inside
 * withRuntime, the runtime the request started on, even while a restart waits for it.
 */
export function whenRuntimeReady(): Promise<Runtime> {
  const slot = runtimeSlot()
  const leased = slot.lease?.getStore()
  if (leased) return Promise.resolve(leased)
  const { booting, restarting } = slot
  if (restarting) return restarting
  if (!booting) {
    return Promise.reject(
      new Error('Mailsink runtime is not booted: is src/runtime/nitro-plugin.ts registered?'),
    )
  }
  return booting
}

/** Resolves when the next stop of the runtime completes, whoever triggered it. */
export function whenRuntimeStopped(): Promise<void> {
  const slot = runtimeSlot()
  return new Promise((resolve) => {
    slot.onStopped ??= []
    slot.onStopped.push(resolve)
  })
}

function inFlight(slot: RuntimeSlot) {
  slot.inFlight ??= { count: 0, idle: [] }
  return slot.inFlight
}

/**
 * Runs one request against the current runtime (server.ts wraps every request). A request
 * arriving during a dev restart waits for the new runtime; one already running keeps the
 * runtime it started on, and the restart waits for it before stopping that runtime
 * (whenRequestsDrained), so it never meets a closed database (#86).
 */
export async function withRuntime<T>(work: () => Promise<T>): Promise<T> {
  const slot = runtimeSlot()
  // `vite dev`: an edit to runtime code is being applied (modules re-evaluated, restart
  // debounced): wait for the new code rather than render with half-updated modules.
  if (!slot.lease?.getStore()) await slot.pendingRestart?.done.catch(() => {})
  let runtime = await whenRuntimeReady()
  // A restart may have started while we waited: run on the new runtime instead.
  while (slot.restarting && !slot.lease?.getStore()) runtime = await slot.restarting
  const counter = inFlight(slot)
  counter.count++
  slot.lease ??= new AsyncLocalStorage<Runtime>()
  try {
    return await slot.lease.run(runtime, work)
  } finally {
    counter.count--
    if (counter.count === 0) for (const resolve of counter.idle.splice(0)) resolve()
  }
}

/**
 * Resolves true once no request runs, false when `timeoutMs` elapsed first (a long poll
 * or a stuck handler must not block a dev restart forever).
 */
export function whenRequestsDrained(timeoutMs: number): Promise<boolean> {
  const counter = inFlight(runtimeSlot())
  if (counter.count === 0) return Promise.resolve(true)
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs)
    counter.idle.push(() => {
      clearTimeout(timer)
      resolve(true)
    })
  })
}

/** Requests currently running (withRuntime). */
export function requestsInFlight(): number {
  return runtimeSlot().inFlight?.count ?? 0
}
