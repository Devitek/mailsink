import {
  ActivateOverrideRequest,
  type OverrideConfig,
  SimulationSettings,
} from '@mailsink/contracts'
import { describe, expect, it } from 'vitest'
import {
  deliveredRemainder,
  formValues,
  type OverrideValues,
  toActivateRequest,
} from './override-form'

const base = SimulationSettings.parse({})

const values = (patch: Partial<OverrideValues> = {}): OverrideValues => ({
  ...formValues({ target: 'workspace', settings: base, rateLimit: null }),
  ...patch,
})

describe('override form values', () => {
  it('starts from the settings in force, every section off', () => {
    const v = formValues({
      target: 'con_1',
      settings: { ...base, rates: { delivered: 80, hard_bounce: 20 } },
      rateLimit: { limit: 120, windowSeconds: 60 },
    })
    expect(v).toMatchObject({
      target: 'con_1',
      expiry: '1h',
      ratesOn: false,
      rates: { hard_bounce: '20', soft_bounce: '0', complained: '0' },
      latencyOn: false,
      minMs: '0',
      maxMs: '0',
      rateLimitOn: false,
      limit: '120',
      window: 'minute',
      rulesOn: false,
      rules: [],
    })
  })

  it('turns on exactly the sections an active override sets', () => {
    const config: OverrideConfig = {
      latency: { minMs: 100, maxMs: 900 },
      chaos: { errorRate: 10, httpCodes: [503], smtpCodes: [421] },
      rules: [
        { match: '*+bounce@*', status: 'hard_bounce' },
        { match: 'slow@*', delayMs: 5000 },
      ],
    }
    const v = formValues({ target: 'workspace', settings: base, rateLimit: null, config })
    expect(v).toMatchObject({
      ratesOn: false,
      latencyOn: true,
      minMs: '100',
      maxMs: '900',
      chaosOn: true,
      errorRate: '10',
      httpCodes: [503],
      smtpCodes: [421],
      rateLimitOn: false,
      rulesOn: true,
      rules: [
        { match: '*+bounce@*', effect: 'hard_bounce', delayMs: '' },
        { match: 'slow@*', effect: 'delay', delayMs: '5000' },
      ],
    })
  })

  it('gives the remainder of the rates to delivered', () => {
    expect(deliveredRemainder({ ...values().rates, hard_bounce: '30', failed: '5' })).toBe(65)
    expect(deliveredRemainder({ ...values().rates, hard_bounce: '80', failed: '40' })).toBe(-20)
  })
})

describe('activation request', () => {
  it('sends only the sections turned on, with the target and the expiry', () => {
    const request = toActivateRequest(
      values({
        target: 'con_1',
        expiry: '15m',
        ratesOn: true,
        rates: { ...values().rates, hard_bounce: '30' },
        rateLimitOn: true,
        limit: '2',
        window: 'second',
      }),
    )
    expect(request).toEqual({
      connectionId: 'con_1',
      ttl: 900,
      config: {
        rates: {
          delivered: 70,
          soft_bounce: 0,
          hard_bounce: 30,
          complained: 0,
          deferred: 0,
          failed: 0,
          invalid: 0,
        },
        rateLimit: { limit: 2, windowSeconds: 1 },
      },
    })
  })

  it('maps rules, chaos and latency, workspace wide until reset', () => {
    const request = toActivateRequest(
      values({
        expiry: 'reset',
        latencyOn: true,
        minMs: '10',
        maxMs: '20',
        chaosOn: true,
        errorRate: '50',
        httpCodes: [429, 500],
        smtpCodes: [451],
        rulesOn: true,
        rules: [
          { match: ' *@bounce.test ', effect: 'hard_bounce', delayMs: '' },
          { match: 'slow@*', effect: 'delay', delayMs: '3000' },
        ],
      }),
    )
    expect(request).toEqual({
      config: {
        latency: { minMs: 10, maxMs: 20 },
        chaos: { errorRate: 50, httpCodes: [429, 500], smtpCodes: [451] },
        rules: [
          { match: '*@bounce.test', status: 'hard_bounce' },
          { match: 'slow@*', delayMs: 3000 },
        ],
      },
    })
    expect(ActivateOverrideRequest.safeParse(request).success).toBe(true)
  })

  it('sends an empty rule list to switch the inherited rules off', () => {
    const request = toActivateRequest(values({ rulesOn: true, rules: [] }))
    expect(request.config).toEqual({ rules: [] })
    expect(ActivateOverrideRequest.safeParse(request).success).toBe(true)
  })
})
