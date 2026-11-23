import { describe, expect, it } from 'vitest'
import { deriveSessionSecret, issueSessionToken, verifySessionToken } from './session-token'

const SECRET = 'a-session-secret-of-at-least-32-chars'
const NOW = 1_800_000_000_000

describe('session tokens', () => {
  it('verifies a token it issued until it expires', () => {
    const token = issueSessionToken(SECRET, { ttlSeconds: 60, now: NOW })
    expect(verifySessionToken(SECRET, token, NOW)).toBe('valid')
    expect(verifySessionToken(SECRET, token, NOW + 59_000)).toBe('valid')
    expect(verifySessionToken(SECRET, token, NOW + 60_000)).toBe('expired')
  })

  it('issues a different token each time', () => {
    const a = issueSessionToken(SECRET, { ttlSeconds: 60, now: NOW })
    const b = issueSessionToken(SECRET, { ttlSeconds: 60, now: NOW })
    expect(a).not.toBe(b)
  })

  it('treats a forged, tampered or malformed token as invalid', () => {
    const token = issueSessionToken(SECRET, { ttlSeconds: 60, now: NOW })
    expect(verifySessionToken('another-secret-of-at-least-32-chars', token, NOW)).toBe('invalid')
    const [version, , nonce, signature] = token.split('.')
    const longer = [version, String(NOW / 1000 + 3600), nonce, signature].join('.')
    expect(verifySessionToken(SECRET, longer, NOW)).toBe('invalid')
    for (const garbage of ['', 'v1', 'v1.x.y.z', 'v2.1.2.3', `${token}.extra`]) {
      expect(verifySessionToken(SECRET, garbage, NOW), garbage).toBe('invalid')
    }
  })

  it('derives a stable secret from the admin key, distinct from the key itself', () => {
    const derived = deriveSessionSecret('admin-key')
    expect(derived).toBe(deriveSessionSecret('admin-key'))
    expect(derived).not.toBe(deriveSessionSecret('other-admin-key'))
    expect(derived).not.toContain('admin-key')
  })
})
