import { describe, expect, it } from 'vitest'
import { formatCountdown, formatTimeLeft, formatTtl } from './format-ttl'

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

describe('formatCountdown', () => {
  it('reads hours, minutes and seconds of what is left, never below zero', () => {
    expect(formatCountdown(at(47 * 60_000 + 12_000), NOW)).toBe('47m 12s')
    expect(formatCountdown(at(5_000), NOW)).toBe('0m 05s')
    expect(formatCountdown(at(2 * 3_600_000 + 61_000), NOW)).toBe('2h 01m 01s')
    expect(formatCountdown(at(-1), NOW)).toBe('0m 00s')
  })
})

describe('formatTtl', () => {
  it('names an idle TTL in its largest whole unit', () => {
    expect(formatTtl(3600, 'en')).toBe('1h')
    expect(formatTtl(90 * 60, 'en')).toBe('90m')
    expect(formatTtl(2 * 86_400, 'fr')).toBe('2j')
  })
})
