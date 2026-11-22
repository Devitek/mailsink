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

/**
 * Environment read once at boot (docs/architecture/01-project-tree.md, « Configuration »).
 * `PORT` is read by Nitro itself. Variables join this schema with the feature using them.
 */
const Env = z.object({
  DATABASE_URL: DatabaseUrl.default(DEFAULT_DATABASE_URL),
  MAILSINK_ADMIN_KEY: z.string().optional(),
  MAILSINK_SMTP_HOST: z.string().default('0.0.0.0'),
  MAILSINK_SMTP_PORT: Port.default(1025),
})

export type RuntimeConfig = {
  databaseUrl: string
  /** Unset: every Admin-key authentication fails (warning logged at boot). */
  adminKey: string | undefined
  smtpHost: string
  smtpPort: number
  workerIntervalMs: number
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
  }
}
