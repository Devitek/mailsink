import { readRuntimeConfig } from './config'
import { createRuntime, type Logger, type Runtime } from './container'
import { installShutdownHooks } from './shutdown'
import { runtimeSlot } from './slot'

export type BootOptions = {
  start?: () => Promise<Runtime>
  log?: Logger
  /** Registers SIGTERM/SIGINT handlers (off in tests). */
  shutdownHooks?: boolean
}

/** Idempotent runtime start: every caller gets the same promise (globalThis slot). */
export function bootRuntime(options: BootOptions = {}): Promise<Runtime> {
  const slot = runtimeSlot()
  if (slot.booting) return slot.booting

  const log = options.log ?? console
  const start = options.start ?? (() => createRuntime(readRuntimeConfig(), log))
  const booting = start().then(
    (runtime) => {
      log.info(`[mailsink] runtime started (pid ${process.pid}, smtp :${runtime.smtpPort})`)
      if (options.shutdownHooks ?? true) installShutdownHooks(stopRuntime, { log })
      return runtime
    },
    (error: unknown) => {
      slot.booting = undefined
      throw error
    },
  )
  slot.booting = booting
  return booting
}

/** Idempotent stop (signal handler and Nitro `close` hook may both call it). */
export function stopRuntime(): Promise<void> {
  const slot = runtimeSlot()
  const { booting } = slot
  if (!booting) return Promise.resolve()
  slot.stopping ??= booting
    .then(
      (runtime) => runtime.stop(),
      () => {},
    )
    .finally(() => {
      slot.booting = undefined
      slot.stopping = undefined
    })
  return slot.stopping
}
