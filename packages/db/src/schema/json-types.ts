// Shapes of the JSON columns, as plain TypeScript types.
// They mirror the Zod schemas of docs/architecture/03-contracts.md and are meant to be
// replaced by the types inferred in @mailsink/contracts once that package exists.

export type SimulatedStatus =
  | 'delivered'
  | 'deferred'
  | 'soft_bounce'
  | 'hard_bounce'
  | 'complained'
  | 'failed'

/** Percentages per simulated status, sum <= 100, remainder goes to delivered. */
export type StatusRates = Partial<Record<SimulatedStatus, number>>

export interface RecipientRule {
  match: string
  status?: SimulatedStatus
  delayMs?: number
  smtpCode?: number
}

export interface Latency {
  minMs: number
  maxMs: number
}

export interface Chaos {
  errorRate: number
  httpCodes: (429 | 500 | 502 | 503)[]
  smtpCodes: (421 | 451 | 452 | 550)[]
}

export interface RateLimitSettings {
  limit: number
  windowSeconds: number
  burst?: number
}

export interface SimulationSettings {
  rates: StatusRates
  rules?: RecipientRule[]
  latency?: Latency
  openRate?: number
  clickRate?: number
}

export interface OverrideConfig {
  rates?: StatusRates
  rules?: RecipientRule[]
  latency?: Latency
  chaos?: Chaos
  rateLimit?: RateLimitSettings
}

export interface Address {
  email: string
  name?: string
}

export interface TranscriptLine {
  at: number
  dir: 'C' | 'S'
  line: string
}
