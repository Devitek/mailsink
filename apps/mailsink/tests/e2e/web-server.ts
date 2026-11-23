import { fileURLToPath } from 'node:url'
import type { PlaywrightTestConfig } from '@playwright/test'

// Shared by both Playwright configs. Ports are fixed so a run never collides with
// `pnpm dev` (3000) or a default SMTP listener (1025); E2E_HTTP_PORT and E2E_SMTP_PORT
// override them (parallel checkouts on one host).
export const HTTP_PORT = Number(process.env.E2E_HTTP_PORT ?? 3506)
export const SMTP_PORT = Number(process.env.E2E_SMTP_PORT ?? 2906)
export const BASE_URL = `http://127.0.0.1:${HTTP_PORT}`
/** Admin key of the server under test: the recipe fixture creates its workspaces with it. */
export const ADMIN_KEY = process.env.E2E_ADMIN_KEY ?? 'e2e-admin-key-not-a-secret'
/** Session secret of the server under test: the expired-session scenario signs a cookie. */
export const SESSION_SECRET = 'e2e-session-secret-not-a-secret-0123456789'
/** Sign-in limiter of the server under test: 3 failures pause a client for 5 s. */
export const LOGIN_LIMIT = { maxAttempts: 3, lockSeconds: 5 }

const appRoot = fileURLToPath(new URL('../..', import.meta.url))
const ci = Boolean(process.env.CI)

type WebServer = NonNullable<PlaywrightTestConfig['webServer']>

/** Runs `node <entry>` through tests/e2e/serve.ts, preceded by an optional build. */
export function webServer({
  entry,
  build,
  env = {},
}: {
  entry: string
  build?: string
  env?: Record<string, string>
}): WebServer {
  const serve = `node tests/e2e/serve.ts ${entry}`
  return {
    command: build ? `${build} && ${serve}` : serve,
    cwd: appRoot,
    url: `${BASE_URL}/healthz`,
    env: {
      PORT: String(HTTP_PORT),
      MAILSINK_SMTP_PORT: String(SMTP_PORT),
      MAILSINK_ADMIN_KEY: ADMIN_KEY,
      // Credentials (Brevo `baseUrl`, `.env` snippets) point at the server under test.
      MAILSINK_PUBLIC_URL: BASE_URL,
      // Simulation jobs are picked up within 100 ms, so assertions wait less.
      MAILSINK_JOBS_POLL_INTERVAL_MS: '100',
      MAILSINK_SESSION_SECRET: SESSION_SECRET,
      MAILSINK_UI_LOGIN_MAX_ATTEMPTS: String(LOGIN_LIMIT.maxAttempts),
      MAILSINK_UI_LOGIN_LOCK_SECONDS: String(LOGIN_LIMIT.lockSeconds),
      ...env,
    },
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'pipe',
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
  }
}

/** Options common to both configs; `name` separates their reports and artifacts. */
export function baseConfig(name: string): PlaywrightTestConfig {
  return {
    forbidOnly: ci,
    retries: ci ? 1 : 0,
    fullyParallel: true,
    outputDir: `${appRoot}/test-results/${name}`,
    reporter: [
      [ci ? 'github' : 'list'],
      ['html', { outputFolder: `${appRoot}/playwright-report/${name}`, open: 'never' }],
    ],
    use: { baseURL: BASE_URL, trace: 'retain-on-failure' },
    projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  }
}
