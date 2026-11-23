import { describe, expect, it } from 'vitest'
import { formatTimeLeft } from './format-ttl'

const NOW = Date.parse('2026-11-23T10:00:00Z')
const at = (ms: number) => new Date(NOW + ms).toISOString()

describe('formatTimeLeft', () => {
  it('picks the largest whole unit, rounded up', () => {
    expect(formatTimeLeft(at(42 * 60_000), 'en', NOW)).toBe('42m')
    expect(formatTimeLeft(at(30_000), 'en', NOW)).toBe('1m')
    expect(formatTimeLeft(at(3 * 3_600_000 + 1), 'en', NOW)).toBe('4h')
    expect(formatTimeLeft(at(2 * 86_400_000), 'en', NOW)).toBe('2d')
  })

  it('follows the locale', () => {
    expect(formatTimeLeft(at(2 * 86_400_000), 'fr', NOW)).toBe('2j')
  })

  it('reads 0 once the expiry passed, and nothing without one', () => {
    expect(formatTimeLeft(at(-5_000), 'en', NOW)).toBe('0m')
    expect(formatTimeLeft(null, 'en', NOW)).toBeUndefined()
  })
})
