import { readRuntimeConfig } from './config'
import { createRuntime, type Logger, type Runtime } from './container'
import { bundledMigrationsFolder } from './migrations'
import { installShutdownHooks } from './shutdown'
import { runtimeSlot, whenRuntimeStopped } from './slot'

export type BootOptions = {
  start?: () => Promise<Runtime>
  log?: Logger
  /** Registers SIGTERM/SIGINT handlers (off in tests). */
  shutdownHooks?: boolean
}

/** Validated config, migrated database, SMTP listener and worker (runtime/container.ts). */
function defaultStart(log: Logger): Promise<Runtime> {
  return createRuntime(readRuntimeConfig(), log, { migrationsFolder: bundledMigrationsFolder() })
}

/** Idempotent runtime start: every caller gets the same promise (globalThis slot). */
export function bootRuntime(options: BootOptions = {}): Promise<Runtime> {
  const slot = runtimeSlot()
  if (slot.booting) return slot.booting

  const log = options.log ?? console
  const start = options.start ?? (() => defaultStart(log))
  // Through a promise so a synchronous throw (invalid config) is a rejection too.
  const booting = Promise.resolve()
    .then(start)
    .then(
      (runtime) => {
        log.info(`[mailsink] runtime started (pid ${process.pid}, smtp :${runtime.smtpPort})`)
        if ((options.shutdownHooks ?? true) && !slot.shutdownHooks) {
          slot.shutdownHooks = true
          installShutdownHooks({ stop: stopRuntime, stopped: whenRuntimeStopped, log })
        }
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
      const waiters = slot.onStopped ?? []
      slot.onStopped = undefined
      for (const resolve of waiters) resolve()
    })
  return slot.stopping
}
