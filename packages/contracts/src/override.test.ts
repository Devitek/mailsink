import { describe, expect, it } from 'vitest'
import { ActivateOverrideRequest, OverrideConfig } from './override'

describe('OverrideConfig', () => {
  it('rejects an empty override', () => {
    const result = OverrideConfig.safeParse({})
    expect(result.error?.issues[0]).toMatchObject({ params: { code: 'override_empty' } })
  })
  it('accepts a single setting', () => {
    expect(OverrideConfig.safeParse({ rates: { hard_bounce: 100 } }).success).toBe(true)
  })
  it('validates nested settings', () => {
    expect(OverrideConfig.safeParse({ latency: { minMs: 5, maxMs: 1 } }).success).toBe(false)
  })
})

describe('ActivateOverrideRequest', () => {
  it('converts the ttl to seconds', () => {
    const parsed = ActivateOverrideRequest.parse({
      connectionId: 'con_0192f3a4',
      config: { chaos: { errorRate: 100 } },
      ttl: '1h',
    })
    expect(parsed.ttl).toBe(3_600)
  })
  it('rejects a non connection id', () => {
    const result = ActivateOverrideRequest.safeParse({
      connectionId: 'ws_0192f3a4',
      config: { chaos: { errorRate: 100 } },
    })
    expect(result.success).toBe(false)
  })
})
