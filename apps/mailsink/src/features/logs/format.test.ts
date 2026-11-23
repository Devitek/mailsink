import { describe, expect, it } from 'vitest'
import { formatLogTime, httpTone, rangeOf, sessionDurationMs } from './format'

describe('logs formatting', () => {
  it('maps HTTP codes on the prototype tones', () => {
    expect([200, 201, 302, 404, 429, 500, null].map(httpTone)).toEqual([
      'delivered',
      'delivered',
      'delivered',
      'soft_bounce',
      'soft_bounce',
      'hard_bounce',
      'queued',
    ])
  })

  it('shows the time with milliseconds, the day only before today', () => {
    const at = new Date(2026, 10, 22, 14, 33, 51, 204)
    expect(formatLogTime(at.toISOString(), 'en', at.getTime())).toBe('14:33:51.204')
    const tomorrow = new Date(2026, 10, 23, 9).getTime()
    expect(formatLogTime(at.toISOString(), 'en', tomorrow)).toBe('Nov 22 14:33:51.204')
    expect(formatLogTime(at.toISOString(), 'fr', tomorrow)).toBe('22 nov. 14:33:51,204')
  })

  it('measures SMTP sessions once they ended', () => {
    const startedAt = '2026-11-22T10:00:00.000Z'
    expect(sessionDurationMs({ startedAt, endedAt: '2026-11-22T10:00:01.250Z' })).toBe(1250)
    expect(sessionDurationMs({ startedAt, endedAt: null })).toBeNull()
  })

  it('describes the rows of a page', () => {
    expect(rangeOf(2, 50, 50, 312)).toBe('51-100 / 312')
    expect(rangeOf(1, 50, 12)).toBe('1-12')
    expect(rangeOf(1, 50, 0, 0)).toBe('0 / 0')
  })
})
