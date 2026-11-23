import { deleteCookie, getCookie, getRequestIP } from '@tanstack/react-start/server'
import type { Runtime } from '../runtime/container'
import { whenRuntimeReady } from '../runtime/slot'
import { createLoginLimiter, type LoginLimiter } from './login-limiter'
import {
  SESSION_COOKIE,
  type SessionStatus,
  sessionCookieOptions,
  sessionStatus,
  uiAuth,
} from './session'

// Request-bound helpers of the UI session, for server functions and the sign-in route.

export async function readSession(): Promise<{ runtime: Runtime; status: SessionStatus }> {
  const runtime = await whenRuntimeReady()
  return { runtime, status: sessionStatus(runtime.config, getCookie(SESSION_COOKIE)) }
}

/** Backstop of every UI server function: route guards redirect before this ever throws. */
export async function requireSession(): Promise<Runtime> {
  const { runtime, status } = await readSession()
  if (status !== 'signed-in') throw new Error('unauthorized: sign in to the web UI first')
  return runtime
}

export async function clearSession(): Promise<void> {
  const { config } = await whenRuntimeReady()
  deleteCookie(SESSION_COOKIE, sessionCookieOptions(config, 0))
}

/**
 * Limiter key: the socket address. `X-Forwarded-For` is not trusted, so behind a reverse
 * proxy every visitor shares one budget (documented in 03-contracts « Web UI auth »).
 */
export const clientAddress = (): string => getRequestIP() ?? 'unknown'

type LimiterHolder = typeof globalThis & {
  [LIMITER_KEY]?: { limiter: LoginLimiter; settings: string }
}
const LIMITER_KEY = Symbol.for('mailsink.login-limiter')

/** One limiter per process (globalThis: it survives HMR), rebuilt if its settings change. */
export function loginLimiter(runtime: Runtime): LoginLimiter {
  const { loginMaxAttempts, loginLockSeconds } = uiAuth(runtime.config)
  const settings = `${loginMaxAttempts}/${loginLockSeconds}`
  const holder = globalThis as LimiterHolder
  if (holder[LIMITER_KEY]?.settings !== settings) {
    const limiter = createLoginLimiter({
      maxAttempts: loginMaxAttempts,
      lockSeconds: loginLockSeconds,
    })
    holder[LIMITER_KEY] = { limiter, settings }
  }
  return holder[LIMITER_KEY].limiter
}
