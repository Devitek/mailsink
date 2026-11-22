import { createHash, timingSafeEqual } from 'node:crypto'

/** Stored form of a `msk_` / `mskw_` key: SHA-256 hex (D11, high entropy, no slow hash). */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex')
}

/**
 * Constant-time comparison of two secrets of any length: both sides are hashed first, so
 * neither the content nor the length leaks through timing.
 */
export function secretsEqual(a: string, b: string): boolean {
  const da = createHash('sha256').update(a, 'utf8').digest()
  const db = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(da, db)
}
