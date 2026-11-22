import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import { issueCode } from './common'
import {
  Chaos,
  Latency,
  RateLimitSettings,
  RecipientRule,
  Retention,
  SimulationSettings,
  SimulationSettingsPatch,
  StatusRates,
} from './settings'

const codeOf = (result: { error?: { issues: z.core.$ZodIssue[] } }) =>
  issueCode(result.error?.issues[0])

describe('StatusRates', () => {
  it('accepts rates summing to 100 or less', () => {
    expect(StatusRates.safeParse({ hard_bounce: 60, delivered: 40 }).success).toBe(true)
    expect(StatusRates.safeParse({ soft_bounce: 10 }).success).toBe(true)
  })
  it('rejects a sum above 100', () => {
    const result = StatusRates.safeParse({ hard_bounce: 60, delivered: 41 })
    expect(codeOf(result)).toBe('rates_sum_exceeds_100')
  })
  it('rejects statuses the simulation cannot draw', () => {
    expect(StatusRates.safeParse({ queued: 10 }).success).toBe(false)
    expect(StatusRates.safeParse({ suppressed: 10 }).success).toBe(false)
  })
  it('rejects a rate outside 0..100', () => {
    expect(StatusRates.safeParse({ failed: -1 }).success).toBe(false)
  })
})

describe('RecipientRule', () => {
  it('needs a status or a delay', () => {
    expect(codeOf(RecipientRule.safeParse({ match: '*@x.io' }))).toBe('rule_needs_effect')
    expect(RecipientRule.safeParse({ match: '*+bounce@*', status: 'hard_bounce' }).success).toBe(
      true,
    )
    expect(RecipientRule.safeParse({ match: '*', delayMs: 0 }).success).toBe(true)
  })
  it('bounds the SMTP code and the delay', () => {
    expect(RecipientRule.safeParse({ match: '*', delayMs: 600_001 }).success).toBe(false)
    expect(RecipientRule.safeParse({ match: '*', status: 'failed', smtpCode: 250 }).success).toBe(
      false,
    )
  })
})

describe('Latency', () => {
  it('accepts min <= max', () => {
    expect(Latency.safeParse({ minMs: 100, maxMs: 100 }).success).toBe(true)
  })
  it('rejects min > max on maxMs', () => {
    const result = Latency.safeParse({ minMs: 200, maxMs: 100 })
    expect(codeOf(result)).toBe('latency_min_gt_max')
    expect(result.error?.issues[0]?.path).toEqual(['maxMs'])
  })
})

describe('Chaos and RateLimitSettings', () => {
  it('applies default codes', () => {
    expect(Chaos.parse({ errorRate: 50 })).toEqual({
      errorRate: 50,
      httpCodes: [500],
      smtpCodes: [451],
    })
  })
  it('rejects unsupported codes', () => {
    expect(Chaos.safeParse({ errorRate: 5, httpCodes: [404] }).success).toBe(false)
  })
  it('defaults the window to 1 second', () => {
    expect(RateLimitSettings.parse({ limit: 10 })).toEqual({ limit: 10, windowSeconds: 1 })
  })
})

describe('SimulationSettings', () => {
  it('fills every default', () => {
    expect(SimulationSettings.parse({})).toEqual({
      rates: { delivered: 100 },
      rules: [],
      latency: { minMs: 0, maxMs: 0 },
      openRate: 0,
      clickRate: 0,
    })
  })
  it('caps rules at 50', () => {
    const rules = Array.from({ length: 51 }, () => ({ match: '*', status: 'failed' }))
    expect(SimulationSettings.safeParse({ rules }).success).toBe(false)
  })
  it('keeps a patch sparse (absent keys inherit)', () => {
    expect(SimulationSettingsPatch.parse({ openRate: 10 })).toEqual({ openRate: 10 })
  })
})

describe('Retention', () => {
  it('accepts a duration within bounds', () => {
    expect(Retention.parse('7d')).toBe(604_800)
  })
  it('rejects too short or too long', () => {
    expect(Retention.safeParse('30s').success).toBe(false)
    expect(Retention.safeParse('366d').success).toBe(false)
  })
})
