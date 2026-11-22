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
}

export function runtimeSlot(): RuntimeSlot {
  const holder = globalThis as typeof globalThis & { [SLOT_KEY]?: RuntimeSlot }
  holder[SLOT_KEY] ??= {}
  return holder[SLOT_KEY]
}

/** Resolves once the runtime booted by the Nitro plugin is ready (used per request). */
export function whenRuntimeReady(): Promise<Runtime> {
  const { booting, restarting } = runtimeSlot()
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
