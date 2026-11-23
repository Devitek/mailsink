import { describe, expect, it } from 'vitest'
import { createRateLimiter } from './token-bucket'

function setup(maxBuckets?: number) {
  let now = 1_000_000
  const limiter = createRateLimiter({ now: () => now, maxBuckets })
  return { limiter, advance: (ms: number) => (now += ms) }
}

describe('token bucket', () => {
  it('lets `limit` calls through, then denies with the wait for one token', () => {
    const { limiter } = setup()
    const settings = { limit: 2, windowSeconds: 1 }
    expect(limiter.take('con_a', settings)).toEqual({
      allowed: true,
      limit: 2,
      remaining: 1,
      resetSeconds: 1,
      retryAfterSeconds: null,
    })
    expect(limiter.take('con_a', settings)).toMatchObject({ allowed: true, remaining: 0 })
    expect(limiter.take('con_a', settings)).toEqual({
      allowed: false,
      limit: 2,
      remaining: 0,
      resetSeconds: 1,
      retryAfterSeconds: 1,
    })
  })

  it('refills continuously over the window', () => {
    const { limiter, advance } = setup()
    const settings = { limit: 2, windowSeconds: 10 }
    limiter.take('con_a', settings)
    limiter.take('con_a', settings)
    expect(limiter.take('con_a', settings)).toMatchObject({
      allowed: false,
      retryAfterSeconds: 5,
      resetSeconds: 10,
    })
    advance(4_999)
    expect(limiter.take('con_a', settings).allowed).toBe(false)
    advance(1)
    expect(limiter.take('con_a', settings)).toMatchObject({ allowed: true, remaining: 0 })
    advance(60_000)
    expect(limiter.take('con_a', settings)).toMatchObject({ allowed: true, remaining: 1 })
  })

  it('caps the bucket at `burst` when set', () => {
    const { limiter } = setup()
    const settings = { limit: 1, windowSeconds: 1, burst: 3 }
    const results = [1, 2, 3, 4].map(() => limiter.take('con_a', settings).allowed)
    expect(results).toEqual([true, true, true, false])
    expect(limiter.take('con_a', settings)).toMatchObject({ limit: 1, resetSeconds: 3 })
  })

  it('keeps one bucket per key', () => {
    const { limiter } = setup()
    const settings = { limit: 1, windowSeconds: 1 }
    expect(limiter.take('con_a', settings).allowed).toBe(true)
    expect(limiter.take('con_a', settings).allowed).toBe(false)
    expect(limiter.take('con_b', settings).allowed).toBe(true)
  })

  it('starts a full bucket when the effective settings change (override)', () => {
    const { limiter } = setup()
    limiter.take('con_a', { limit: 1, windowSeconds: 60 })
    expect(limiter.take('con_a', { limit: 1, windowSeconds: 60 }).allowed).toBe(false)
    expect(limiter.take('con_a', { limit: 2, windowSeconds: 60 })).toMatchObject({
      allowed: true,
      remaining: 1,
    })
  })

  it('drops full buckets once maxBuckets is exceeded', () => {
    const { limiter, advance } = setup(2)
    const settings = { limit: 1, windowSeconds: 1 }
    limiter.take('con_a', settings)
    limiter.take('con_b', settings)
    advance(1_000)
    limiter.take('con_c', settings)
    expect(limiter.size()).toBe(1)
  })
})
