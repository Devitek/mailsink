import { describe, expect, it } from 'vitest'
import { WEBHOOK_RETRY_MAX_MS, webhookRetryDelayMs } from './retry'

describe('webhook retry delay', () => {
  it('doubles from 5 s, caps at 1 h and jitters by 20 %', () => {
    const mid = () => 0.5
    expect(webhookRetryDelayMs(1, mid)).toBe(5_000)
    expect(webhookRetryDelayMs(2, mid)).toBe(10_000)
    expect(webhookRetryDelayMs(7, mid)).toBe(320_000)
    expect(webhookRetryDelayMs(20, mid)).toBe(WEBHOOK_RETRY_MAX_MS)
    expect(webhookRetryDelayMs(1, () => 0)).toBe(4_000)
    expect(webhookRetryDelayMs(1, () => 0.999_999)).toBeCloseTo(6_000, -1)
  })
})
