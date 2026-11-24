import type { RuntimeConfig, UiAuthConfig } from '../runtime/config'
import { UI_AUTH_DEFAULTS } from '../runtime/config'
import { deriveSessionSecret, issueSessionToken, verifySessionToken } from './session-token'

// Web UI session rules (D13, D160 and D161), free of any request context so
// the sign-in handler and the server functions share them and tests call them directly.

export const SESSION_COOKIE = 'mailsink_session'

/**
 * `expired` covers a cookie that is no longer valid (lifetime over, secret rotated): the
 * sign-in page then shows L1d. Without any cookie the visitor is `signed-out` (L1a).
 */
export type SessionStatus = 'signed-in' | 'signed-out' | 'expired'

/** The cookie outlives its token by 30 days so an expired session is recognised as such. */
const COOKIE_GRACE_SECONDS = 30 * 86_400

export const uiAuth = (config: RuntimeConfig): UiAuthConfig => config.ui ?? UI_AUTH_DEFAULTS

/** Signing secret; undefined when neither a secret nor an admin key is configured. */
export function sessionSecret(config: RuntimeConfig): string | undefined {
  const explicit = uiAuth(config).sessionSecret
  if (explicit) return explicit
  return config.adminKey ? deriveSessionSecret(config.adminKey) : undefined
}

export function sessionStatus(
  config: RuntimeConfig,
  cookie: string | undefined,
  now = Date.now(),
): SessionStatus {
  if (uiAuth(config).auth === 'none') return 'signed-in'
  if (!cookie) return 'signed-out'
  const secret = sessionSecret(config)
  if (!secret) return 'expired'
  return verifySessionToken(secret, cookie, now) === 'valid' ? 'signed-in' : 'expired'
}

type CookieOptions = {
  path: string
  httpOnly: true
  sameSite: 'lax'
  secure: boolean
  maxAge: number
}

export function sessionCookieOptions(config: RuntimeConfig, maxAge?: number): CookieOptions {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: config.publicUrl.startsWith('https:'),
    maxAge: maxAge ?? uiAuth(config).sessionTtlSeconds + COOKIE_GRACE_SECONDS,
  }
}

/** `Set-Cookie` value of a fresh session (the secret must exist). */
export function newSessionCookie(config: RuntimeConfig, secret: string, now = Date.now()) {
  const token = issueSessionToken(secret, { ttlSeconds: uiAuth(config).sessionTtlSeconds, now })
  const o = sessionCookieOptions(config)
  const attributes = [`Path=${o.path}`, `Max-Age=${o.maxAge}`, 'HttpOnly', 'SameSite=Lax']
  if (o.secure) attributes.push('Secure')
  return [`${SESSION_COOKIE}=${token}`, ...attributes].join('; ')
}
