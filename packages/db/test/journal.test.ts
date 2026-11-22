import { describe, expect, it } from 'vitest'
import { journalEntries } from './journal'

describe('migrations journal', () => {
  it('numbers migrations in order with strictly increasing timestamps', async () => {
    // The migrator skips a migration whose `when` is not after the last applied one.
    const entries = await journalEntries()
    entries.forEach((entry, i) => {
      expect(entry.idx).toBe(i)
      expect(entry.tag.startsWith(String(i).padStart(4, '0'))).toBe(true)
      if (i > 0) expect(entry.when).toBeGreaterThan(entries[i - 1]?.when ?? Infinity)
    })
  })
})
