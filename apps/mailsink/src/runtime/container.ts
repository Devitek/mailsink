import {
  type ActivityTracker,
  createActivityTracker,
  createEventBus,
  createJobRunner,
  createRateLimiter,
  DEFAULT_JOB_SETTINGS,
  deliverWebhookHandler,
  type EventBus,
  publishExpiredOverrides,
  type Random,
  type RateLimiter,
  simulateDeliveryHandler,
  startEphemeralGc,
  startOverrideExpiryScheduler,
  startRetentionScheduler,
  startWorker,
} from '@mailsink/core'
import { createDb, type DbHandle, migrate } from '@mailsink/db'
import { readTlsFiles, startSmtpServer } from '@mailsink/smtp'
import type { RuntimeConfig } from './config'

export type Logger = Pick<Console, 'info' | 'warn' | 'error'>

/**
 * Long-lived services of the process (D3), built once and shared by the server routes,
 * the server functions, the SMTP listener and the workers. Bus and stores join here later.
 */
export type Runtime = {
  config: RuntimeConfig
  db: DbHandle
  /** In-process event bus (D6): SSE, wait=true, later MCP. */
  bus: EventBus
  /** Throttled workspace activity (D16): every surface touches it. */
  activity: ActivityTracker
  /** In-memory token buckets per connection (D7), shared by HTTP and SMTP ingestion. */
  rateLimiter: RateLimiter
  /** Source of the request-level chaos draws (#25), injectable in tests. */
  chaosRandom: Random
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

    const bus = createEventBus(log)
    // HTTP surfaces touch it through the defineApi activity extension; the SMTP server
    // touches it once AUTH resolves the connection, then on every transaction.
    const activity = createActivityTracker({ db: db.db, log })
    const rateLimiter = createRateLimiter()
    // SMTP ingestion (#31): AUTH against smtp connections, the shared rate limiter and the
    // chaos source of the runtime (read at each draw, so tests can swap it), the ingestion
    // pipeline. recordSmtpSession is a no-op until the smtp_sessions writer (#35).
    let self: Runtime | undefined
    const smtp = await startSmtpServer({
      host: config.smtpHost,
      port: config.smtpPort,
      db: db.db,
      bus,
      activity,
      rateLimiter,
      random: () => (self?.chaosRandom ?? Math.random)(),
      maxMessageBytes: config.maxMessageBytes,
      ...(config.smtpTls ? { tls: await readTlsFiles(config.smtpTls) } : {}),
      log,
    })

    // Job queue (D5): handlers join here (deliver_webhook with #33); kinds without a
    // handler stay in the table untouched.
    const jobs = config.jobs ?? DEFAULT_JOB_SETTINGS
    const runJobs = createJobRunner({
      db: db.db,
      handlers: {
        simulate_delivery: simulateDeliveryHandler({ bus }),
        deliver_webhook: deliverWebhookHandler({ bus }),
      },
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
    const gc = startEphemeralGc({ db: db.db, bus, activity, log })
    // Closes overrides past their TTL (#22); reads already ignore them. Each pass that
    // closes some publishes override.changed on the workspaces concerned (D96).
    const overrideExpiry = startOverrideExpiryScheduler({
      db: db.db,
      log,
      onExpired: (closed) => publishExpiredOverrides(db.db, bus, closed),
    })

    self = {
      config,
      db,
      bus,
      activity,
      rateLimiter,
      chaosRandom: Math.random,
      smtpPort: smtp.port,
      async stop() {
        // Stop accepting mail, drain the worker that would process it and the retention
        // and GC passes in flight, write the pending activity, then close the db.
        await smtp.close()
        await Promise.all([worker.stop(), retention.stop(), gc.stop()])
        await overrideExpiry.stop()
        await activity.stop()
        await db.close()
      },
    }
    return self
  } catch (error) {
    await db.close().catch(() => {})
    throw error
  }
}
