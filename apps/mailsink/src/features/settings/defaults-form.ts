import type {
  RateLimitSettings,
  RecipientRule,
  SimulatedStatus,
  SimulationSettings,
  UpdateWorkspaceRequest,
} from '@mailsink/contracts'
import { z } from 'zod'
import { retentionSeconds } from '../workspaces/workspace-form'

// Values, validation and request mapping of the defaults sections of the settings page
// (#43): retention and message quota, default simulation and rate limit. Messages come
// translated from the components (Lingui), so this module stays pure.

export type DefaultsMessages = { number: string; sum: string; latency: string }

/** Statuses drawn before the remainder goes to `delivered` (D71), in draw order. */
export const DRAWN_STATUSES = [
  'deferred',
  'soft_bounce',
  'hard_bounce',
  'complained',
  'failed',
  'invalid',
] as const satisfies readonly SimulatedStatus[]
export type DrawnStatus = (typeof DRAWN_STATUSES)[number]

const INT_RE = /^\s*(\d{1,9})?\s*$/
const PERCENT_RE = /^\s*(\d{1,3}(\.\d{1,2})?)?\s*$/
const num = (text: string) => (text.trim() === '' ? 0 : Number(text))

// Retention and quota

export type RetentionValues = { retention: string; maxMessages: string }

export const retentionSchema = (m: DefaultsMessages) =>
  z.object({
    retention: z.string(),
    maxMessages: z
      .string()
      .regex(INT_RE, m.number)
      .refine((v) => v.trim() === '' || Number(v) >= 1, m.number),
  })

export function toRetentionPatch(values: RetentionValues): z.input<typeof UpdateWorkspaceRequest> {
  const quota = values.maxMessages.trim()
  return {
    retention: retentionSeconds(values.retention),
    maxMessages: quota === '' ? null : Number(quota),
  }
}

// Simulation and rate limit

export type SimulationValues = {
  rates: Record<DrawnStatus, string>
  latencyMin: string
  latencyMax: string
  openRate: string
  clickRate: string
  /** Requests per window, empty = unlimited; window in seconds; burst optional. */
  rateLimit: string
  rateWindow: string
  burst: string
}

const text = (value: number | undefined) => (value ? String(value) : '')

export function simulationValues(
  settings: SimulationSettings,
  rateLimit: RateLimitSettings | null,
): SimulationValues {
  const rates = Object.fromEntries(
    DRAWN_STATUSES.map((status) => [status, text(settings.rates[status])]),
  ) as Record<DrawnStatus, string>
  return {
    rates,
    latencyMin: String(settings.latency.minMs),
    latencyMax: String(settings.latency.maxMs),
    openRate: String(settings.openRate),
    clickRate: String(settings.clickRate),
    rateLimit: rateLimit ? String(rateLimit.limit) : '',
    rateWindow: String(rateLimit?.windowSeconds ?? 1),
    burst: text(rateLimit?.burst),
  }
}

/** Share of `delivered`: what the drawn statuses leave (never below 0). */
export function deliveredShare(rates: Record<DrawnStatus, string>): number {
  const taken = DRAWN_STATUSES.reduce((sum, status) => sum + num(rates[status]), 0)
  return Math.max(0, Math.round((100 - taken) * 100) / 100)
}

const percent = (m: DefaultsMessages) =>
  z
    .string()
    .regex(PERCENT_RE, m.number)
    .refine((v) => num(v) <= 100, m.number)
const latency = (m: DefaultsMessages) =>
  z
    .string()
    .regex(INT_RE, m.number)
    .refine((v) => num(v) <= 600_000, m.number)
const positive = (m: DefaultsMessages) =>
  z
    .string()
    .regex(INT_RE, m.number)
    .refine((v) => v.trim() === '' || Number(v) >= 1, m.number)

export const simulationSchema = (m: DefaultsMessages) =>
  z
    .object({
      rates: z.object(
        Object.fromEntries(DRAWN_STATUSES.map((s) => [s, percent(m)])) as Record<
          DrawnStatus,
          ReturnType<typeof percent>
        >,
      ),
      latencyMin: latency(m),
      latencyMax: latency(m),
      openRate: percent(m),
      clickRate: percent(m),
      rateLimit: positive(m),
      rateWindow: positive(m),
      burst: positive(m),
    })
    .superRefine((values, ctx) => {
      const taken = DRAWN_STATUSES.reduce((sum, s) => sum + num(values.rates[s]), 0)
      if (taken > 100) ctx.addIssue({ code: 'custom', message: m.sum, path: ['rates'] })
      if (num(values.latencyMin) > num(values.latencyMax)) {
        ctx.addIssue({ code: 'custom', message: m.latency, path: ['latencyMax'] })
      }
    })

/** A complete simulation (rules kept as they are: not edited here) and the rate limit. */
export function toSimulationPatch(
  values: SimulationValues,
  rules: RecipientRule[],
): z.input<typeof UpdateWorkspaceRequest> {
  const rates: Partial<Record<DrawnStatus, number>> = {}
  for (const status of DRAWN_STATUSES) {
    if (num(values.rates[status]) > 0) rates[status] = num(values.rates[status])
  }
  const limit = values.rateLimit.trim()
  const burst = values.burst.trim()
  return {
    simulation: {
      rates,
      rules,
      latency: { minMs: num(values.latencyMin), maxMs: num(values.latencyMax) },
      openRate: num(values.openRate),
      clickRate: num(values.clickRate),
    },
    rateLimit:
      limit === ''
        ? null
        : {
            limit: Number(limit),
            windowSeconds: Number(values.rateWindow.trim() || 1),
            ...(burst ? { burst: Number(burst) } : {}),
          },
  }
}
