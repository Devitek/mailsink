import { SimulationSettings } from '@mailsink/contracts'
import { describe, expect, it } from 'vitest'
import { formValues, type OverrideValues } from './override-form'
import { type OverrideMessages, overrideSchema } from './override-schema'

const m: OverrideMessages = {
  nothingOn: 'nothing',
  percent: 'percent',
  ratesOver: 'over',
  delay: 'delay',
  latencyOrder: 'order',
  codes: 'codes',
  limit: 'limit',
  match: 'match',
}
const schema = overrideSchema(m)
const values = (patch: Partial<OverrideValues>): OverrideValues => ({
  ...formValues({ target: 'workspace', settings: SimulationSettings.parse({}), rateLimit: null }),
  ...patch,
})

function issues(v: OverrideValues) {
  const result = schema.safeParse(v)
  return result.success ? [] : result.error.issues.map((i) => [i.path.join('.'), i.message])
}

describe('override schema', () => {
  it('needs at least one section', () => {
    expect(issues(values({}))).toEqual([['', 'nothing']])
    expect(issues(values({ latencyOn: true }))).toEqual([])
  })

  it('checks the rates and their sum, only when on', () => {
    const rates = { ...values({}).rates, hard_bounce: '70', failed: '40' }
    expect(issues(values({ rates, rulesOn: true }))).toEqual([])
    expect(issues(values({ rates, ratesOn: true }))).toEqual([
      ['rates.hard_bounce', 'over'],
      ['rates.failed', 'over'],
    ])
    expect(issues(values({ ratesOn: true, rates: { ...rates, failed: 'x' } }))).toContainEqual([
      'rates.failed',
      'percent',
    ])
  })

  it('checks the latency bounds and order', () => {
    expect(issues(values({ latencyOn: true, minMs: '500', maxMs: '100' }))).toEqual([
      ['maxMs', 'order'],
    ])
    expect(issues(values({ latencyOn: true, minMs: '-1', maxMs: '700000' }))).toEqual([
      ['minMs', 'delay'],
      ['maxMs', 'delay'],
    ])
  })

  it('checks chaos, rate limit and rules', () => {
    expect(issues(values({ chaosOn: true, errorRate: '101', httpCodes: [] }))).toEqual([
      ['errorRate', 'percent'],
      ['httpCodes', 'codes'],
    ])
    expect(issues(values({ rateLimitOn: true, limit: '0' }))).toEqual([['limit', 'limit']])
    expect(
      issues(
        values({
          rulesOn: true,
          rules: [
            { match: ' ', effect: 'hard_bounce', delayMs: '' },
            { match: 'a@*', effect: 'delay', delayMs: '' },
          ],
        }),
      ),
    ).toEqual([
      ['rules.0.match', 'match'],
      ['rules.1.delayMs', 'delay'],
    ])
  })
})
