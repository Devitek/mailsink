import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

// Stateless UI session token (D13, proposition D160): `v1.<expires>.<nonce>.<signature>`,
// expiry in epoch seconds, HMAC-SHA256 over the first three parts. Nothing is stored server
// side: rotating the secret (or the admin key it derives from) ends every session.

const VERSION = 'v1'

export type SessionVerdict = 'valid' | 'expired' | 'invalid'

const sign = (secret: string, payload: string) =>
  createHmac('sha256', secret).update(payload).digest('base64url')

/** Secret used when `MAILSINK_SESSION_SECRET` is unset: derived, never the admin key itself. */
export function deriveSessionSecret(adminKey: string): string {
  return createHmac('sha256', adminKey).update('mailsink-ui-session-v1').digest('base64url')
}

export function issueSessionToken(
  secret: string,
  { ttlSeconds, now = Date.now() }: { ttlSeconds: number; now?: number },
): string {
  const expires = Math.floor(now / 1000) + ttlSeconds
  const payload = `${VERSION}.${expires}.${randomBytes(12).toString('base64url')}`
  return `${payload}.${sign(secret, payload)}`
}

export function verifySessionToken(
  secret: string,
  token: string,
  now: number = Date.now(),
): SessionVerdict {
  const parts = token.split('.')
  if (parts.length !== 4 || parts[0] !== VERSION) return 'invalid'
  const [, expires, , signature = ''] = parts
  const expected = Buffer.from(sign(secret, parts.slice(0, 3).join('.')))
  const given = Buffer.from(signature)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return 'invalid'
  if (!/^\d+$/.test(expires ?? '')) return 'invalid'
  return Number(expires) * 1000 > now ? 'valid' : 'expired'
}
