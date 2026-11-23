import {
  createJobRunner,
  DEFAULT_JOB_SETTINGS,
  simulateDeliveryHandler,
  startOverrideExpiryScheduler,
  startRetentionScheduler,
  startWorker,
} from '@mailsink/core'
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
 * Opens and migrates the database, then starts the SMTP listener, the job worker and the
 * retention scheduler.
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
  // createDb owns the pool `error` listener (an idle client losing its connection); the
  // runtime only routes the warning to its logger.
  const db = createDb(config.databaseUrl, {
    onConnectionError: (error) => log.warn(`[mailsink] database connection lost: ${error.message}`),
  })
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

    // Job queue (D5): handlers join here (deliver_webhook with #33); kinds without a
    // handler stay in the table untouched.
    const jobs = config.jobs ?? DEFAULT_JOB_SETTINGS
    const runJobs = createJobRunner({
      db: db.db,
      handlers: { simulate_delivery: simulateDeliveryHandler() },
      batchSize: jobs.batchSize,
      lockSeconds: jobs.lockSeconds,
      maxAttempts: jobs.maxAttempts,
      backoff: { baseSeconds: jobs.backoffBaseSeconds, maxSeconds: jobs.backoffMaxSeconds },
      log,
    })
    const worker = startWorker({
      intervalMs: config.workerIntervalMs,
      tick: async (signal) => {
        await runJobs(signal)
      },
      onError: (error) => log.error('[mailsink] worker tick failed', error),
    })
    const retention = startRetentionScheduler({
      db: db.db,
      intervalMs: config.retentionIntervalMs ?? 60_000,
      failedJobRetentionSeconds: jobs.failedRetentionSeconds,
      log,
    })
    // Closes overrides past their TTL (#22); reads already ignore them.
    const overrideExpiry = startOverrideExpiryScheduler({ db: db.db, log })

    return {
      config,
      db,
      smtpPort: smtp.port,
      async stop() {
        // Stop accepting mail, drain the worker that would process it and the retention
        // pass in flight, then close the db.
        await smtp.close()
        await Promise.all([worker.stop(), retention.stop()])
        await overrideExpiry.stop()
        await db.close()
      },
    }
  } catch (error) {
    await db.close().catch(() => {})
    throw error
  }
}
