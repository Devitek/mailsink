import { UpdateWorkspaceRequest } from '@mailsink/contracts'
import { describe, expect, it } from 'vitest'
import {
  deliveredShare,
  retentionSchema,
  simulationSchema,
  simulationValues,
  toRetentionPatch,
  toSimulationPatch,
} from './defaults-form'

const messages = { number: 'number', sum: 'sum', latency: 'latency' }

describe('retention form', () => {
  it('maps the preset and the quota, empty = unbounded', () => {
    expect(toRetentionPatch({ retention: '24h', maxMessages: ' 500 ' })).toEqual({
      retention: 86_400,
      maxMessages: 500,
    })
    expect(toRetentionPatch({ retention: '3600', maxMessages: '' })).toEqual({
      retention: 3600,
      maxMessages: null,
    })
    expect(retentionSchema(messages).safeParse({ retention: '7d', maxMessages: '0' }).success).toBe(
      false,
    )
  })
})

describe('simulation form', () => {
  const settings = {
    rates: { hard_bounce: 5, delivered: 100 },
    rules: [{ match: '*@bounce.test', status: 'hard_bounce' as const }],
    latency: { minMs: 10, maxMs: 200 },
    openRate: 30,
    clickRate: 5,
  }

  it('reads the settings back as text, delivered being the remainder', () => {
    const values = simulationValues(settings, { limit: 20, windowSeconds: 1, burst: 40 })
    expect(values.rates.hard_bounce).toBe('5')
    expect(values.rates.soft_bounce).toBe('')
    expect(values).toMatchObject({ latencyMin: '10', rateLimit: '20', burst: '40' })
    expect(deliveredShare(values.rates)).toBe(95)
  })

  it('builds a complete simulation (rules kept) and the rate limit', () => {
    const values = simulationValues(settings, null)
    values.rates.complained = '2.5'
    values.rateLimit = '10'
    const patch = toSimulationPatch(values, settings.rules)
    expect(UpdateWorkspaceRequest.parse(patch)).toEqual({
      simulation: {
        rates: { hard_bounce: 5, complained: 2.5 },
        rules: settings.rules,
        latency: { minMs: 10, maxMs: 200 },
        openRate: 30,
        clickRate: 5,
      },
      rateLimit: { limit: 10, windowSeconds: 1 },
    })
    values.rateLimit = ''
    expect(toSimulationPatch(values, []).rateLimit).toBeNull()
  })

  it('refuses rates above 100 in total and a latency min above max', () => {
    const values = simulationValues(settings, null)
    values.rates.failed = '96'
    const sum = simulationSchema(messages).safeParse(values)
    expect(sum.error?.issues[0]?.message).toBe('sum')
    const latency = simulationSchema(messages).safeParse({
      ...simulationValues(settings, null),
      latencyMin: '300',
    })
    expect(latency.error?.issues[0]?.path).toEqual(['latencyMax'])
  })
})
