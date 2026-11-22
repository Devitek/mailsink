import type { Runtime } from './container'

/**
 * The runtime slot lives on globalThis, not in module scope: Vite HMR re-evaluates modules,
 * and the production build emits two bundles (Nitro plugin and SSR server entry) that must
 * see the same runtime. This module has no runtime dependency so the SSR bundle can import it
 * without pulling smtp-server in a second time.
 */
const SLOT_KEY = Symbol.for('mailsink.runtime')

export type RuntimeSlot = { booting?: Promise<Runtime>; stopping?: Promise<void> }

export function runtimeSlot(): RuntimeSlot {
  const holder = globalThis as typeof globalThis & { [SLOT_KEY]?: RuntimeSlot }
  holder[SLOT_KEY] ??= {}
  return holder[SLOT_KEY]
}

/** Resolves once the runtime booted by the Nitro plugin is ready (used per request). */
export function whenRuntimeReady(): Promise<Runtime> {
  const { booting } = runtimeSlot()
  if (!booting) {
    return Promise.reject(
      new Error('Mailsink runtime is not booted: is src/runtime/nitro-plugin.ts registered?'),
    )
  }
  return booting
}
