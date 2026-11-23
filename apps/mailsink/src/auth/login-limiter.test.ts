import { describe, expect, it } from 'vitest'
import { createLoginLimiter } from './login-limiter'

function setup(maxAttempts = 3, lockSeconds = 60) {
  let now = 1_000_000
  const limiter = createLoginLimiter({ maxAttempts, lockSeconds, now: () => now })
  return { limiter, advance: (ms: number) => (now += ms) }
}

describe('login limiter', () => {
  it('locks a client after the threshold of failures, for lockSeconds', () => {
    const { limiter, advance } = setup()
    expect(limiter.retryAfter('a')).toBe(0)
    limiter.fail('a')
    limiter.fail('a')
    expect(limiter.retryAfter('a')).toBe(0)
    limiter.fail('a')
    expect(limiter.retryAfter('a')).toBe(60)
    advance(41_500)
    expect(limiter.retryAfter('a')).toBe(19)
    advance(18_500)
    expect(limiter.retryAfter('a')).toBe(0)
  })

  it('starts counting again after a pause', () => {
    const { limiter, advance } = setup()
    for (let i = 0; i < 3; i++) limiter.fail('a')
    advance(60_000)
    limiter.fail('a')
    expect(limiter.retryAfter('a')).toBe(0)
  })

  it('forgets failures older than the window and after a success', () => {
    const { limiter, advance } = setup()
    limiter.fail('a')
    limiter.fail('a')
    advance(60_000)
    limiter.fail('a')
    expect(limiter.retryAfter('a')).toBe(0)
    limiter.fail('a')
    limiter.succeed('a')
    limiter.fail('a')
    expect(limiter.retryAfter('a')).toBe(0)
  })

  it('keeps clients apart and prunes idle entries', () => {
    const { limiter, advance } = setup(1)
    limiter.fail('a')
    expect(limiter.retryAfter('a')).toBe(60)
    expect(limiter.retryAfter('b')).toBe(0)
    advance(120_000)
    limiter.fail('b')
    expect(limiter.size()).toBe(1)
  })
})
