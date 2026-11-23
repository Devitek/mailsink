import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/** Entries kept at most; the oldest verified one is dropped first. */
export const CREDENTIAL_CACHE_SIZE = 10_000

/**
 * Verified SMTP credentials (D11): scrypt runs once per (connection, stored hash, password).
 * An entry only holds an HMAC of the password under a per-process random key, never the
 * password. It is bound to the stored hash, so a password rotation invalidates it without
 * any explicit eviction.
 */
export interface CredentialCache {
  /** True when this password was verified against this stored hash before. */
  has(connectionId: string, storedHash: string, password: string): boolean
  remember(connectionId: string, storedHash: string, password: string): void
  readonly size: number
}

export function createCredentialCache(maxEntries = CREDENTIAL_CACHE_SIZE): CredentialCache {
  const key = randomBytes(32)
  const entries = new Map<string, Buffer>()
  const digest = (storedHash: string, password: string) =>
    createHmac('sha256', key).update(storedHash).update('\0').update(password).digest()

  return {
    has(connectionId, storedHash, password) {
      const known = entries.get(connectionId)
      return known !== undefined && timingSafeEqual(known, digest(storedHash, password))
    },
    remember(connectionId, storedHash, password) {
      entries.delete(connectionId)
      entries.set(connectionId, digest(storedHash, password))
      if (entries.size > maxEntries) {
        const oldest = entries.keys().next().value
        if (oldest !== undefined) entries.delete(oldest)
      }
    },
    get size() {
      return entries.size
    },
  }
}
