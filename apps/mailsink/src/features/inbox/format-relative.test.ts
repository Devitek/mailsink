import { describe, expect, it } from 'vitest'
import { formatBytes, formatRelative } from './format-relative'

const now = Date.parse('2026-11-23T12:00:00Z')
const ago = (ms: number) => new Date(now - ms).toISOString()
/** Intl separates numbers and units with a narrow no-break space in French. */
const plain = (text: string | null) => text?.replace(/\s/g, ' ')

describe('inbox times and sizes', () => {
  it('leaves the first minute to the caller', () => {
    expect(formatRelative(ago(30_000), now, 'en')).toBeNull()
    expect(formatRelative(ago(-5_000), now, 'en')).toBeNull()
  })

  it('counts minutes, hours, then days, then shows the date', () => {
    expect(formatRelative(ago(2 * 60_000), now, 'en')).toBe('2 min')
    expect(formatRelative(ago(3 * 3_600_000), now, 'en')).toBe('3 hr')
    expect(plain(formatRelative(ago(3 * 3_600_000), now, 'fr'))).toBe('3 h')
    expect(formatRelative(ago(2 * 86_400_000), now, 'en')).toBe('2 days')
    expect(formatRelative(ago(30 * 86_400_000), now, 'en')).toBe('Oct 24')
  })

  it('formats sizes in decimal units', () => {
    expect(formatBytes(512, 'en')).toBe('512 byte')
    expect(formatBytes(2_400, 'en')).toBe('2.4 kB')
    expect(plain(formatBytes(3_200_000, 'fr'))).toBe('3,2 Mo')
  })
})
