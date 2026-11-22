import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { KEY_PREFIXES } from '@mailsink/contracts'
import { hashApiKey } from '../crypto'

export interface GeneratedKey {
  /** Full secret, shown once. */
  key: string
  /** Stored SHA-256 hex (D11). */
  hash: string
  /** Stored, shown in views as `keyPreview` (prefix + 8 characters). */
  displayPrefix: string
}

const DISPLAY_CHARS = 8

/** `msk_` connection key or `mskw_` workspace key (D12): 32 random bytes, base64url. */
export function generateKey(scope: 'connection' | 'workspace'): GeneratedKey {
  const prefix = KEY_PREFIXES[scope]
  const key = `${prefix}${randomBytes(32).toString('base64url')}`
  return {
    key,
    hash: hashApiKey(key),
    displayPrefix: key.slice(0, prefix.length + DISPLAY_CHARS),
  }
}

export function generateSmtpPassword(): string {
  return randomBytes(24).toString('base64url')
}

/** `<slug>-<8 hex>`, at most 64 characters (ConnectionInput `smtpUsername` pattern). */
export function generateSmtpUsername(slug: string): string {
  return `${slug.slice(0, 55)}-${randomBytes(4).toString('hex')}`
}

// scrypt parameters (D11): N = 2^14, r = 8, p = 1, 32-byte key, 16-byte salt.
const N = 16_384
const R = 8
const P = 1
const KEY_LENGTH = 32

function derive(password: string, salt: Buffer, n: number, r: number, p: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N: n, r, p }, (error, key) =>
      error ? reject(error) : resolve(key),
    )
  })
}

/** Stored form: `scrypt$N$r$p$<salt base64>$<key base64>`, parameters kept for upgrades. */
export async function hashSmtpPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await derive(password, salt, N, R, P)
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$')
}

export async function verifySmtpPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, salt, key] = stored.split('$')
  if (algo !== 'scrypt' || !n || !r || !p || !salt || !key) return false
  const expected = Buffer.from(key, 'base64')
  const actual = await derive(password, Buffer.from(salt, 'base64'), +n, +r, +p)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
