import type { Logger } from './container'

const SIGNALS = ['SIGTERM', 'SIGINT'] as const

export type ShutdownOptions = {
  log?: Logger
  /** Signal source, `process` by default (injectable for tests). */
  target?: Pick<NodeJS.Process, 'on'>
  exit?: (code: number) => void
  /** Hard limit for a graceful stop before forcing the exit. */
  timeoutMs?: number
}

/**
 * First SIGTERM/SIGINT stops the runtime (SMTP, then worker) and exits 0.
 * A second signal, or a stop slower than `timeoutMs`, exits 1 immediately.
 */
export function installShutdownHooks(
  stop: () => Promise<void>,
  options: ShutdownOptions = {},
): void {
  const log = options.log ?? console
  const target = options.target ?? process
  const exit = options.exit ?? ((code: number) => process.exit(code))
  const timeoutMs = options.timeoutMs ?? 10_000
  let stopping = false

  const onSignal = (signal: string) => {
    if (stopping) {
      log.error(`[mailsink] ${signal} received again, forcing exit`)
      exit(1)
      return
    }
    stopping = true
    log.info(`[mailsink] ${signal} received, stopping runtime`)
    const timer = setTimeout(() => {
      log.error(`[mailsink] runtime did not stop within ${timeoutMs} ms, forcing exit`)
      exit(1)
    }, timeoutMs)
    timer.unref?.()
    stop().then(
      () => {
        clearTimeout(timer)
        log.info('[mailsink] runtime stopped (smtp closed, worker drained)')
        exit(0)
      },
      (error: unknown) => {
        clearTimeout(timer)
        log.error('[mailsink] runtime stop failed', error)
        exit(1)
      },
    )
  }

  for (const signal of SIGNALS) target.on(signal, onSignal)
}
