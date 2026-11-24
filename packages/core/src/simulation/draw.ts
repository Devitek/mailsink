import type { Latency, SimulatedStatus, StatusRates } from '@mailsink/contracts'
import type { Random } from './rng'

/** Statuses drawn from the rates, in a fixed order; whatever is left goes to `delivered`. */
const DRAWN: readonly Exclude<SimulatedStatus, 'delivered'>[] = [
  'deferred',
  'soft_bounce',
  'hard_bounce',
  'complained',
  'failed',
  'invalid',
]

/**
 * Weighted draw: each non-delivered status takes its percentage of [0, 100), the
 * remainder (100 minus their sum, whatever `delivered` declares) goes to `delivered`.
 */
export function drawStatus(rates: StatusRates, random: Random): SimulatedStatus {
  const roll = random() * 100
  let cumulative = 0
  for (const status of DRAWN) {
    cumulative += rates[status] ?? 0
    if (roll < cumulative) return status
  }
  return 'delivered'
}

/** Uniform integer delay in [minMs, maxMs]. */
export function drawLatency(latency: Latency, random: Random): number {
  const span = latency.maxMs - latency.minMs
  return latency.minMs + Math.floor(random() * (span + 1))
}
