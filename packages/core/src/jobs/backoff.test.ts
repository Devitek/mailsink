import { describe, expect, it } from 'vitest'
import { backoffSeconds } from './backoff'

describe('backoffSeconds', () => {
  it('doubles from the base delay', () => {
    expect([1, 2, 3, 4].map((n) => backoffSeconds(n))).toEqual([5, 10, 20, 40])
  })

  it('is capped and tolerates attempt 0', () => {
    expect(backoffSeconds(30)).toBe(900)
    expect(backoffSeconds(3, { baseSeconds: 1, maxSeconds: 3 })).toBe(3)
    expect(backoffSeconds(0)).toBe(5)
  })
})
