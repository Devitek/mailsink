import type { Logger } from './container'

const SIGNALS = ['SIGTERM', 'SIGINT'] as const

type Env = Record<string, string | undefined>

/**
 * srvx (Nitro's Node server) traps SIGTERM/SIGINT itself, drains HTTP for up to
 * `SERVER_SHUTDOWN_TIMEOUT` seconds (default 5) then fires Nitro's `close` hook, which stops
 * the runtime (nitro-plugin.ts). It skips that when `CI` or `TEST` is set.
 */
export function srvxDrainsHttp(env: Env = process.env): boolean {
  return !(env.CI || env.TEST)
}

export function srvxDrainMs(env: Env = process.env): number {
  const seconds = Number.parseInt(env.SERVER_SHUTDOWN_TIMEOUT ?? '', 10)
  return (Number.isNaN(seconds) || seconds <= 0 ? 5 : seconds) * 1000
}

export type ShutdownOptions = {
  /** Stops the runtime; idempotent (a no-op once the close hook stopped it). */
  stop: () => Promise<void>
  /** Resolves when the runtime has been stopped by anyone (the Nitro close hook). */
  stopped: () => Promise<void>
  log?: Logger
  /** Signal source, `process` by default (injectable for tests). */
  target?: Pick<NodeJS.Process, 'on'>
  exit?: (code: number) => void
  /** Whether srvx drains HTTP and then fires the close hook (srvxDrainsHttp()). */
  httpDrains?: boolean
  /** How long to wait for the close hook before stopping the runtime anyway. */
  drainTimeoutMs?: number
  /** Hard limit of the whole shutdown before forcing exit 1. */
  timeoutMs?: number
}

/**
 * First SIGTERM/SIGINT: let srvx drain in-flight HTTP requests, wait for the close hook to
 * stop the runtime (SMTP, worker, database), then exit 0. The explicit exit guards against a
 * leftover handle keeping the process alive. A second signal, a failed stop or a shutdown
 * slower than `timeoutMs` exits 1.
 */
export function installShutdownHooks(options: ShutdownOptions): void {
  const log = options.log ?? console
  const target = options.target ?? process
  const exit = options.exit ?? ((code: number) => process.exit(code))
  const httpDrains = options.httpDrains ?? srvxDrainsHttp()
  const drainTimeoutMs = options.drainTimeoutMs ?? srvxDrainMs() + 2000
  const timeoutMs = options.timeoutMs ?? drainTimeoutMs + 10_000
  let stopping = false

  const onSignal = (signal: string) => {
    if (stopping) {
      log.error(`[mailsink] ${signal} received again, forcing exit`)
      exit(1)
      return
    }
    stopping = true
    log.info(
      `[mailsink] ${signal} received, ${httpDrains ? 'draining HTTP then stopping' : 'stopping'} runtime`,
    )
    const hardTimer = setTimeout(() => {
      log.error(`[mailsink] shutdown did not complete within ${timeoutMs} ms, forcing exit`)
      exit(1)
    }, timeoutMs)
    hardTimer.unref?.()

    shutdown(options, httpDrains, drainTimeoutMs).then(
      () => {
        clearTimeout(hardTimer)
        log.info('[mailsink] runtime stopped (smtp closed, worker drained, db closed)')
        exit(0)
      },
      (error: unknown) => {
        clearTimeout(hardTimer)
        log.error('[mailsink] runtime stop failed', error)
        exit(1)
      },
    )
  }

  for (const signal of SIGNALS) target.on(signal, onSignal)
}

async function shutdown(options: ShutdownOptions, httpDrains: boolean, drainTimeoutMs: number) {
  if (httpDrains) {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, drainTimeoutMs)
      timer.unref?.()
    })
    await Promise.race([options.stopped(), timeout])
    clearTimeout(timer)
  }
  await options.stop()
}
