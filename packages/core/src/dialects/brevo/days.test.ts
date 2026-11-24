import { describe, expect, it } from 'vitest'
import { zonedDayRange, zonedToday } from './days'

describe('Brevo calendar days in the workspace timezone (D23)', () => {
  it('spans UTC days for UTC and an unknown zone', () => {
    expect(zonedDayRange('2026-01-10', '2026-01-11', 'UTC')).toEqual({
      since: new Date('2026-01-10T00:00:00Z'),
      until: new Date('2026-01-12T00:00:00Z'),
    })
    expect(zonedDayRange('2026-01-10', '2026-01-10', 'Not/AZone').since).toEqual(
      new Date('2026-01-10T00:00:00Z'),
    )
  })

  it('starts each day at local midnight, across daylight saving changes', () => {
    expect(zonedDayRange('2026-01-10', '2026-01-10', 'Europe/Paris')).toEqual({
      since: new Date('2026-01-09T23:00:00Z'),
      until: new Date('2026-01-10T23:00:00Z'),
    })
    // 29/03/2026: Paris moves to UTC+2, a 23 hour day.
    expect(zonedDayRange('2026-03-29', '2026-03-29', 'Europe/Paris')).toEqual({
      since: new Date('2026-03-28T23:00:00Z'),
      until: new Date('2026-03-29T22:00:00Z'),
    })
    expect(zonedDayRange('2026-07-01', '2026-07-01', 'America/New_York').since).toEqual(
      new Date('2026-07-01T04:00:00Z'),
    )
    expect(zonedDayRange('2026-07-01', '2026-07-01', 'Pacific/Kiritimati').since).toEqual(
      new Date('2026-06-30T10:00:00Z'),
    )
  })

  it('tells the current day of the zone', () => {
    const now = new Date('2026-11-24T23:30:00Z')
    expect(zonedToday(now, 'UTC')).toBe('2026-11-24')
    expect(zonedToday(now, 'Europe/Paris')).toBe('2026-11-25')
    expect(zonedToday(now, 'America/Los_Angeles')).toBe('2026-11-24')
    expect(zonedToday(now, 'Not/AZone')).toBe('2026-11-24')
  })
})
