export type RuntimeConfig = {
  smtpHost: string
  smtpPort: number
  workerIntervalMs: number
}

type Env = Record<string, string | undefined>

function readPort(env: Env, name: string, fallback: number): number {
  const value = env[name]
  if (value === undefined || value === '') return fallback
  const port = Number(value)
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`${name} must be a port number (0-65535), got "${value}"`)
  }
  return port
}

/**
 * Runtime settings read once at boot. The full Zod-validated configuration
 * (docs/architecture/01-project-tree.md) replaces this when the DB lands.
 */
export function readRuntimeConfig(env: Env = process.env): RuntimeConfig {
  return {
    smtpHost: env.MAILSINK_SMTP_HOST || '0.0.0.0',
    smtpPort: readPort(env, 'MAILSINK_SMTP_PORT', 1025),
    workerIntervalMs: 1000,
  }
}
