import { startWorker } from '@mailsink/core'
import { startSmtpListener } from '@mailsink/smtp'
import type { RuntimeConfig } from './config'

export type Logger = Pick<Console, 'info' | 'error'>

/** Long-lived services of the process (D3). DB, bus and stores join here later. */
export type Runtime = {
  smtpPort: number
  stop: () => Promise<void>
}

/** Starts the SMTP listener and the job worker. Called once per process by boot.ts. */
export async function createRuntime(
  config: RuntimeConfig,
  log: Logger = console,
): Promise<Runtime> {
  const smtp = await startSmtpListener({
    host: config.smtpHost,
    port: config.smtpPort,
    onMessage: (message) => {
      log.info(
        `[mailsink] smtp: message from ${message.from ?? '<>'} to ${message.to.join(', ')} (${message.raw.length} bytes)`,
      )
    },
  })

  const worker = startWorker({
    intervalMs: config.workerIntervalMs,
    tick: async () => {},
    onError: (error) => log.error('[mailsink] worker tick failed', error),
  })

  return {
    smtpPort: smtp.port,
    async stop() {
      // Stop accepting mail first, then drain the worker that would process it.
      await smtp.close()
      await worker.stop()
    },
  }
}
