import { startWorker } from '@mailsink/core'
import { createDb, type DbHandle, migrate } from '@mailsink/db'
import { startSmtpListener } from '@mailsink/smtp'
import type { RuntimeConfig } from './config'

export type Logger = Pick<Console, 'info' | 'warn' | 'error'>

/**
 * Long-lived services of the process (D3), built once and shared by the server routes,
 * the server functions, the SMTP listener and the workers. Bus and stores join here later.
 */
export type Runtime = {
  config: RuntimeConfig
  db: DbHandle
  smtpPort: number
  stop: () => Promise<void>
}

export interface CreateRuntimeOptions {
  /** Migrations folder of the bundled app (see runtime/migrations.ts); sources by default. */
  migrationsFolder?: string
}

/**
 * Opens and migrates the database, then starts the SMTP listener and the job worker.
 * Called once per process by boot.ts. On failure, whatever was opened is closed again.
 */
export async function createRuntime(
  config: RuntimeConfig,
  log: Logger = console,
  options: CreateRuntimeOptions = {},
): Promise<Runtime> {
  if (!config.adminKey) {
    log.warn('[mailsink] MAILSINK_ADMIN_KEY is not set: the Admin API refuses every call')
  }
  const db = createDb(config.databaseUrl)
  if (db.driver === 'postgres') {
    // An idle pooled client losing its connection (Postgres restart) emits `error` on the
    // pool; unhandled, it becomes an uncaughtException. The pool reconnects on next use.
    const pool = db.client as unknown as NodeJS.EventEmitter
    pool.on('error', (error: Error) => {
      log.warn(`[mailsink] database connection lost: ${error.message}`)
    })
  }
  try {
    await migrate(db, { migrationsFolder: options.migrationsFolder })
    log.info(`[mailsink] database ready (${db.driver}, migrations applied)`)

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
      config,
      db,
      smtpPort: smtp.port,
      async stop() {
        // Stop accepting mail, drain the worker that would process it, then close the db.
        await smtp.close()
        await worker.stop()
        await db.close()
      },
    }
  } catch (error) {
    await db.close().catch(() => {})
    throw error
  }
}
