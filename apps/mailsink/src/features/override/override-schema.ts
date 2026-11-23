import { z } from 'zod'
import { anyOn, deliveredRemainder, type OverrideValues, RATE_STATUSES } from './override-form'

// Validation of the override panel (#42), on the typed strings: the same bounds as the
// `OverrideConfig` contract (percentages, delays up to 600 000 ms, min <= max, rates <= 100
// in total), checked only for the sections turned on. Messages come translated (Lingui).

export type OverrideMessages = {
  nothingOn: string
  percent: string
  ratesOver: string
  delay: string
  latencyOrder: string
  codes: string
  limit: string
  match: string
}

const MAX_DELAY_MS = 600_000
const INT = /^\s*\d+\s*$/

const intIn = (value: string, max: number) => INT.test(value) && Number(value) <= max

export const overrideSchema = (m: OverrideMessages) =>
  z.custom<OverrideValues>().superRefine((v, ctx) => {
    const fail = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message })
    if (!anyOn(v)) {
      fail([], m.nothingOn)
    }
    if (v.ratesOn) {
      const bad = RATE_STATUSES.filter((s) => !intIn(v.rates[s], 100))
      for (const s of bad) fail(['rates', s], m.percent)
      // On every rate set (a form-level path would never be cleared by TanStack Form).
      if (bad.length === 0 && deliveredRemainder(v.rates) < 0) {
        for (const s of RATE_STATUSES) if (Number(v.rates[s]) > 0) fail(['rates', s], m.ratesOver)
      }
    }
    if (v.latencyOn) {
      const minOk = intIn(v.minMs, MAX_DELAY_MS)
      const maxOk = intIn(v.maxMs, MAX_DELAY_MS)
      if (!minOk) fail(['minMs'], m.delay)
      if (!maxOk) fail(['maxMs'], m.delay)
      if (minOk && maxOk && Number(v.minMs) > Number(v.maxMs)) fail(['maxMs'], m.latencyOrder)
    }
    if (v.chaosOn) {
      if (!intIn(v.errorRate, 100)) fail(['errorRate'], m.percent)
      if (v.httpCodes.length === 0) fail(['httpCodes'], m.codes)
      if (v.smtpCodes.length === 0) fail(['smtpCodes'], m.codes)
    }
    if (v.rateLimitOn && !(intIn(v.limit, 1_000_000) && Number(v.limit) > 0)) {
      fail(['limit'], m.limit)
    }
    if (v.rulesOn) {
      v.rules.forEach((rule, i) => {
        if (rule.match.trim() === '') fail(['rules', i, 'match'], m.match)
        if (rule.effect === 'delay' && !intIn(rule.delayMs, MAX_DELAY_MS)) {
          fail(['rules', i, 'delayMs'], m.delay)
        }
      })
    }
  })
