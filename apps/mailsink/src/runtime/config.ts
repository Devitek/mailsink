import { Duration, IDLE_TTL_BOUNDS } from '@mailsink/contracts'
import { DEFAULT_JOB_SETTINGS, DEFAULT_MAX_MESSAGE_BYTES, type JobSettings } from '@mailsink/core'
import { DEFAULT_DATABASE_URL, parseDatabaseUrl } from '@mailsink/db'
import { z } from 'zod'

const Port = z.coerce
  .number({ error: 'must be a port number (0-65535)' })
  .int('must be a port number (0-65535)')
  .min(0, 'must be a port number (0-65535)')
  .max(65535, 'must be a port number (0-65535)')

/** Whole number within bounds, the message naming the expected range and unit. */
const Int = (min: number, max: number, unit: string) => {
  const message = `must be ${unit} (${min}-${max})`
  return z.coerce.number({ error: message }).int(message).min(min, message).max(max, message)
}

/** Host name or IP literal given to SMTP clients (no scheme, port or spaces). */
const Host = z
  .string()
  .regex(/^[A-Za-z0-9.:[\]-]+$/, 'must be a host name or an IP address, without port')

const DatabaseUrl = z.string().superRefine((url, ctx) => {
  try {
    parseDatabaseUrl(url)
  } catch (error) {
    ctx.addIssue({ code: 'custom', message: (error as Error).message })
  }
})

/** Bare seconds ("3600") or a duration ("1h"), within the idle TTL bounds of the contract. */
const IdleTtl = z
  .string()
  .transform((v) => (/^\d+$/.test(v) ? Number(v) : v))
  .pipe(Duration)
  .pipe(z.number().min(IDLE_TTL_BOUNDS.min).max(IDLE_TTL_BOUNDS.max))

/** Absolute http(s) URL, stored without its trailing slash. */
const PublicUrl = z
  .url({ protocol: /^https?$/, error: 'must be an absolute http(s) URL' })
  .transform((url) => url.replace(/\/+$/, ''))

/**
 * Environment read once at boot (docs/architecture/01-project-tree.md, « Configuration »).
 * `PORT` is read by Nitro itself. Variables join this schema with the feature using them.
 */
const Env = z
  .object({
    DATABASE_URL: DatabaseUrl.default(DEFAULT_DATABASE_URL),
    MAILSINK_ADMIN_KEY: z.string().optional(),
    MAILSINK_SMTP_HOST: z.string().default('0.0.0.0'),
    MAILSINK_SMTP_PORT: Port.default(1025),
    MAILSINK_SMTP_PUBLIC_HOST: Host.optional(),
    MAILSINK_SMTP_PUBLIC_PORT: Int(1, 65_535, 'a port number').optional(),
    MAILSINK_RETENTION_INTERVAL_SECONDS: Int(1, 86_400, 'a number of seconds').default(60),
    MAILSINK_JOBS_POLL_INTERVAL_MS: Int(10, 60_000, 'a number of milliseconds').default(
      DEFAULT_JOB_SETTINGS.pollIntervalMs,
    ),
    MAILSINK_JOBS_BATCH_SIZE: Int(1, 1000, 'a number of jobs').default(
      DEFAULT_JOB_SETTINGS.batchSize,
    ),
    MAILSINK_JOBS_LOCK_SECONDS: Int(1, 86_400, 'a number of seconds').default(
      DEFAULT_JOB_SETTINGS.lockSeconds,
    ),
    MAILSINK_JOBS_MAX_ATTEMPTS: Int(1, 100, 'a number of attempts').default(
      DEFAULT_JOB_SETTINGS.maxAttempts,
    ),
    MAILSINK_JOBS_BACKOFF_BASE_SECONDS: Int(1, 86_400, 'a number of seconds').default(
      DEFAULT_JOB_SETTINGS.backoffBaseSeconds,
    ),
    MAILSINK_JOBS_BACKOFF_MAX_SECONDS: Int(1, 86_400, 'a number of seconds').default(
      DEFAULT_JOB_SETTINGS.backoffMaxSeconds,
    ),
    MAILSINK_JOBS_FAILED_RETENTION_SECONDS: Int(60, 31_536_000, 'a number of seconds').default(
      DEFAULT_JOB_SETTINGS.failedRetentionSeconds,
    ),
    MAILSINK_MAX_MESSAGE_BYTES: z.coerce
      .number({ error: 'must be a positive number of bytes' })
      .int('must be a positive number of bytes')
      .positive('must be a positive number of bytes')
      .default(DEFAULT_MAX_MESSAGE_BYTES),
    MAILSINK_PUBLIC_URL: PublicUrl.default('http://localhost:3000'),
    MAILSINK_DEFAULT_IDLE_TTL: IdleTtl.default(3600),
  })
  .refine((e) => e.MAILSINK_JOBS_BACKOFF_MAX_SECONDS >= e.MAILSINK_JOBS_BACKOFF_BASE_SECONDS, {
    path: ['MAILSINK_JOBS_BACKOFF_MAX_SECONDS'],
    message: 'must not be below MAILSINK_JOBS_BACKOFF_BASE_SECONDS',
  })

export type RuntimeConfig = {
  databaseUrl: string
  /** Unset: every Admin-key authentication fails (warning logged at boot). */
  adminKey: string | undefined
  smtpHost: string
  smtpPort: number
  /** Host written in SMTP credentials; unset = the hostname of `publicUrl`. */
  smtpPublicHost?: string
  /** Port written in SMTP credentials; unset = the port the listener is bound to. */
  smtpPublicPort?: number
  /** Job worker polling period (`MAILSINK_JOBS_POLL_INTERVAL_MS`). */
  workerIntervalMs: number
  /**
   * Job runner tunables (`MAILSINK_JOBS_*`). Always set by readRuntimeConfig; optional so
   * hand-built test configs need not list them (DEFAULT_JOB_SETTINGS applies).
   */
  jobs?: Omit<JobSettings, 'pollIntervalMs'>
  /**
   * Period of the retention scheduler (#17). Always set by readRuntimeConfig; optional so
   * hand-built test configs need not list it (the container defaults it to 60 s).
   */
  retentionIntervalMs?: number
  /** Ingestion cap (`MAILSINK_MAX_MESSAGE_BYTES`): request bodies and composed messages. */
  maxMessageBytes: number
  /** Base of the links and `.env` snippets given to clients (D35), no trailing slash. */
  publicUrl: string
  /** Idle TTL of ephemeral workspaces created without `idleTtlSeconds` (#19). */
  defaultIdleTtlSeconds: number
}

type EnvSource = Record<string, string | undefined>

/** Validates the environment; the error lists variable names, never their values. */
export function readRuntimeConfig(env: EnvSource = process.env): RuntimeConfig {
  // An empty variable means unset, as in most shells and compose files.
  const present = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''))
  const parsed = Env.safeParse(present, { reportInput: false })
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`)
    throw new Error(`Invalid configuration:\n${lines.join('\n')}`)
  }
  const e = parsed.data
  return {
    databaseUrl: e.DATABASE_URL,
    adminKey: e.MAILSINK_ADMIN_KEY,
    smtpHost: e.MAILSINK_SMTP_HOST,
    smtpPort: e.MAILSINK_SMTP_PORT,
    smtpPublicHost: e.MAILSINK_SMTP_PUBLIC_HOST,
    smtpPublicPort: e.MAILSINK_SMTP_PUBLIC_PORT,
    workerIntervalMs: e.MAILSINK_JOBS_POLL_INTERVAL_MS,
    retentionIntervalMs: e.MAILSINK_RETENTION_INTERVAL_SECONDS * 1000,
    maxMessageBytes: e.MAILSINK_MAX_MESSAGE_BYTES,
    publicUrl: e.MAILSINK_PUBLIC_URL,
    defaultIdleTtlSeconds: e.MAILSINK_DEFAULT_IDLE_TTL,
    jobs: {
      batchSize: e.MAILSINK_JOBS_BATCH_SIZE,
      lockSeconds: e.MAILSINK_JOBS_LOCK_SECONDS,
      maxAttempts: e.MAILSINK_JOBS_MAX_ATTEMPTS,
      backoffBaseSeconds: e.MAILSINK_JOBS_BACKOFF_BASE_SECONDS,
      backoffMaxSeconds: e.MAILSINK_JOBS_BACKOFF_MAX_SECONDS,
      failedRetentionSeconds: e.MAILSINK_JOBS_FAILED_RETENTION_SECONDS,
    },
  }
}
