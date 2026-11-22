import { Duration, IDLE_TTL_BOUNDS } from '@mailsink/contracts'
import { DEFAULT_MAX_MESSAGE_BYTES } from '@mailsink/core'
import { DEFAULT_DATABASE_URL, parseDatabaseUrl } from '@mailsink/db'
import { z } from 'zod'

const Port = z.coerce
  .number({ error: 'must be a port number (0-65535)' })
  .int('must be a port number (0-65535)')
  .min(0, 'must be a port number (0-65535)')
  .max(65535, 'must be a port number (0-65535)')

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
const Env = z.object({
  DATABASE_URL: DatabaseUrl.default(DEFAULT_DATABASE_URL),
  MAILSINK_ADMIN_KEY: z.string().optional(),
  MAILSINK_SMTP_HOST: z.string().default('0.0.0.0'),
  MAILSINK_SMTP_PORT: Port.default(1025),
  MAILSINK_RETENTION_INTERVAL_SECONDS: z.coerce
    .number({ error: 'must be a number of seconds (1-86400)' })
    .int('must be a number of seconds (1-86400)')
    .min(1, 'must be a number of seconds (1-86400)')
    .max(86_400, 'must be a number of seconds (1-86400)')
    .default(60),
  MAILSINK_MAX_MESSAGE_BYTES: z.coerce
    .number({ error: 'must be a positive number of bytes' })
    .int('must be a positive number of bytes')
    .positive('must be a positive number of bytes')
    .default(DEFAULT_MAX_MESSAGE_BYTES),
  MAILSINK_PUBLIC_URL: PublicUrl.default('http://localhost:3000'),
  MAILSINK_DEFAULT_IDLE_TTL: IdleTtl.default(3600),
})

export type RuntimeConfig = {
  databaseUrl: string
  /** Unset: every Admin-key authentication fails (warning logged at boot). */
  adminKey: string | undefined
  smtpHost: string
  smtpPort: number
  workerIntervalMs: number
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
    workerIntervalMs: 1000,
    retentionIntervalMs: e.MAILSINK_RETENTION_INTERVAL_SECONDS * 1000,
    maxMessageBytes: e.MAILSINK_MAX_MESSAGE_BYTES,
    publicUrl: e.MAILSINK_PUBLIC_URL,
    defaultIdleTtlSeconds: e.MAILSINK_DEFAULT_IDLE_TTL,
  }
}
