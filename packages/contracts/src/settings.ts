import { z } from 'zod'
import { Duration, issue } from './common'
import { SimulatedStatus } from './status'

export const DEFAULT_RETENTION_SECONDS = 7 * 86_400
const MAX_DELAY_MS = 600_000
const Percent = z.number().min(0).max(100)

/** Retention: a Duration between 1 minute and 365 days. */
export const Retention = Duration.pipe(
  z
    .number()
    .min(60, 'Retention must be at least 60s')
    .max(365 * 86_400, 'Retention max is 365d'),
)

/** Percentages per simulated status; the remainder goes to `delivered`. */
export const StatusRates = z
  .partialRecord(SimulatedStatus, Percent)
  .refine(
    (r) => Object.values(r).reduce<number>((sum, v) => sum + (v ?? 0), 0) <= 100,
    issue('rates_sum_exceeds_100', 'Status rates must not add up to more than 100'),
  )

export const RecipientRule = z
  .object({
    match: z.string().min(1), // glob: "*+bounce@*"
    status: SimulatedStatus.optional(),
    delayMs: z.number().int().min(0).max(MAX_DELAY_MS).optional(),
    smtpCode: z.number().int().min(400).max(599).optional(),
  })
  .refine(
    (r) => r.status !== undefined || r.delayMs !== undefined,
    issue('rule_needs_effect', 'A rule needs a status or a delayMs'),
  )

export const Latency = z
  .object({
    minMs: z.number().int().min(0).max(MAX_DELAY_MS),
    maxMs: z.number().int().min(0).max(MAX_DELAY_MS),
  })
  .refine(
    (l) => l.minMs <= l.maxMs,
    issue('latency_min_gt_max', 'minMs must be lower than or equal to maxMs', ['maxMs']),
  )

/** Fails the request itself (HTTP or SMTP), before ingestion. */
export const Chaos = z.object({
  errorRate: Percent,
  httpCodes: z
    .array(z.union([z.literal(429), z.literal(500), z.literal(502), z.literal(503)]))
    .min(1)
    .default([500]),
  smtpCodes: z
    .array(z.union([z.literal(421), z.literal(451), z.literal(452), z.literal(550)]))
    .min(1)
    .default([451]),
})

export const RateLimitSettings = z.object({
  limit: z.number().int().positive(), // tokens per window
  windowSeconds: z.number().int().positive().default(1),
  burst: z.number().int().positive().optional(),
})

const RecipientRules = z.array(RecipientRule).max(50)

/** Partial simulation settings (connection level, override): absent keys inherit. */
export const SimulationSettingsPatch = z.object({
  rates: StatusRates.optional(),
  rules: RecipientRules.optional(),
  latency: Latency.optional(), // queued -> final status
  openRate: Percent.optional(), // automatic opened / clicked events
  clickRate: Percent.optional(),
})

/** Complete simulation settings (workspace level, resolved values). */
export const SimulationSettings = z.object({
  rates: StatusRates.default({ delivered: 100 }),
  rules: RecipientRules.default([]),
  latency: Latency.default({ minMs: 0, maxMs: 0 }),
  openRate: Percent.default(0),
  clickRate: Percent.default(0),
})

export type StatusRates = z.output<typeof StatusRates>
export type RecipientRule = z.output<typeof RecipientRule>
export type Latency = z.output<typeof Latency>
export type Chaos = z.output<typeof Chaos>
export type RateLimitSettings = z.output<typeof RateLimitSettings>
export type SimulationSettingsPatch = z.output<typeof SimulationSettingsPatch>
export type SimulationSettings = z.output<typeof SimulationSettings>
