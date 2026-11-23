import type {
  ActivateOverrideRequest,
  Chaos,
  OverrideConfig,
  RateLimitSettings,
  RecipientRule,
  SimulatedStatus,
  SimulationSettings,
} from '@mailsink/contracts'
import type { z } from 'zod'

// Values and request mapping of the override panel (#42). Every section (rates, latency,
// chaos, rate limit, rules) has a switch: a section turned off is left out of the override
// and keeps inheriting the settings. Numbers stay strings while typed (see override-schema).

/** Statuses with a rate field; `delivered` takes the remainder (simulation/draw.ts). */
export const RATE_STATUSES = [
  'soft_bounce',
  'hard_bounce',
  'complained',
  'deferred',
  'failed',
] as const satisfies readonly SimulatedStatus[]
export type RateStatus = (typeof RATE_STATUSES)[number]

export const HTTP_CODES = [429, 500, 502, 503] as const
export const SMTP_CODES = [421, 451, 452, 550] as const

/** Expiry presets of the prototype; `reset` = no TTL. */
export const EXPIRY_SECONDS = { '15m': 900, '1h': 3_600, reset: undefined }
export type Expiry = keyof typeof EXPIRY_SECONDS

export type RuleEffect = SimulatedStatus | 'delay'
export type RuleValues = { match: string; effect: RuleEffect; delayMs: string }

/** `workspace` or a connection id. */
export type OverrideTarget = string
export const WORKSPACE_TARGET = 'workspace'

export type OverrideValues = {
  target: OverrideTarget
  expiry: Expiry
  ratesOn: boolean
  rates: Record<RateStatus, string>
  latencyOn: boolean
  minMs: string
  maxMs: string
  chaosOn: boolean
  errorRate: string
  httpCodes: number[]
  smtpCodes: number[]
  rateLimitOn: boolean
  limit: string
  window: 'second' | 'minute'
  rulesOn: boolean
  rules: RuleValues[]
}

const text = (n: number | undefined) => (n === undefined ? '' : String(n))

function ruleValues(rule: RecipientRule): RuleValues {
  if (rule.status) return { match: rule.match, effect: rule.status, delayMs: text(rule.delayMs) }
  return { match: rule.match, effect: 'delay', delayMs: text(rule.delayMs) }
}

function rateLimitValues(rate: RateLimitSettings | null | undefined) {
  if (!rate) return { limit: '', window: 'second' as const }
  if (rate.windowSeconds === 60) return { limit: String(rate.limit), window: 'minute' as const }
  return { limit: String(Math.ceil(rate.limit / rate.windowSeconds)), window: 'second' as const }
}

/**
 * Starting values of the panel for one target: the active override of that target when
 * there is one (its sections on), else the settings in force (every section off).
 */
export function formValues({
  target,
  settings,
  rateLimit,
  config,
}: {
  target: OverrideTarget
  settings: SimulationSettings
  rateLimit: RateLimitSettings | null
  config?: OverrideConfig
}): OverrideValues {
  const rates = config?.rates ?? settings.rates
  const latency = config?.latency ?? settings.latency
  const rules = config?.rules ?? settings.rules
  return {
    target,
    expiry: '1h',
    ratesOn: config?.rates !== undefined,
    rates: Object.fromEntries(RATE_STATUSES.map((s) => [s, String(rates[s] ?? 0)])) as Record<
      RateStatus,
      string
    >,
    latencyOn: config?.latency !== undefined,
    minMs: String(latency.minMs),
    maxMs: String(latency.maxMs),
    chaosOn: config?.chaos !== undefined,
    errorRate: String(config?.chaos?.errorRate ?? 0),
    httpCodes: config?.chaos?.httpCodes ?? [500],
    smtpCodes: config?.chaos?.smtpCodes ?? [451],
    rateLimitOn: config?.rateLimit !== undefined,
    ...rateLimitValues(config?.rateLimit ?? rateLimit),
    rulesOn: config?.rules !== undefined,
    rules: rules.map(ruleValues),
  }
}

/** At least one section is part of the override (the contract refuses an empty one). */
export const anyOn = (v: OverrideValues): boolean =>
  v.ratesOn || v.latencyOn || v.chaosOn || v.rateLimitOn || v.rulesOn

/** Share of `delivered`: 100 minus the other rates (negative when they exceed 100). */
export function deliveredRemainder(rates: Record<RateStatus, string>): number {
  return 100 - RATE_STATUSES.reduce((sum, s) => sum + (Number(rates[s]) || 0), 0)
}

function toRule(rule: RuleValues): RecipientRule {
  const match = rule.match.trim()
  if (rule.effect === 'delay') return { match, delayMs: Number(rule.delayMs) }
  return { match, status: rule.effect }
}

/** The request of « Apply the override » (values already validated by the schema). */
export function toActivateRequest(v: OverrideValues): z.input<typeof ActivateOverrideRequest> {
  const config: OverrideConfig = {}
  if (v.ratesOn) {
    const rates: Partial<Record<SimulatedStatus, number>> = {
      delivered: Math.max(0, deliveredRemainder(v.rates)),
    }
    for (const s of RATE_STATUSES) rates[s] = Number(v.rates[s]) || 0
    config.rates = rates
  }
  if (v.latencyOn) config.latency = { minMs: Number(v.minMs), maxMs: Number(v.maxMs) }
  if (v.chaosOn) {
    config.chaos = {
      errorRate: Number(v.errorRate),
      httpCodes: v.httpCodes as Chaos['httpCodes'],
      smtpCodes: v.smtpCodes as Chaos['smtpCodes'],
    }
  }
  if (v.rateLimitOn) {
    config.rateLimit = { limit: Number(v.limit), windowSeconds: v.window === 'minute' ? 60 : 1 }
  }
  if (v.rulesOn) config.rules = v.rules.map(toRule)
  const ttl = EXPIRY_SECONDS[v.expiry]
  return {
    ...(v.target === WORKSPACE_TARGET ? {} : { connectionId: v.target }),
    config,
    ...(ttl ? { ttl } : {}),
  }
}
