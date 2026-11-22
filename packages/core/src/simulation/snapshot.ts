import type { SimulatedStatus } from '@mailsink/contracts'

/** Decision of one recipient, as stored in `messages.simulation.recipients[email]`. */
export interface RecipientDecisionEntry {
  status: SimulatedStatus
  reason?: string
  smtpCode?: number
  delayMs: number
  /** 0 for the first decision, n after n `deferred`. */
  attempt: number
  decidedAt: string
  /** When the final status is due (ISO); the follow-up job runs then. */
  dueAt: string
  /** Set once the final status is written. */
  appliedAt?: string
  [detail: string]: unknown
}

/**
 * `messages.simulation`: what the simulation decided and why, readable in the capture
 * detail. `seed` replays the draws; the planner context (override ids, setting sources)
 * is merged at each decision.
 */
export interface SimulationSnapshot {
  seed: number
  recipients: Record<string, RecipientDecisionEntry>
  [context: string]: unknown
}

export function readSnapshot(
  value: Record<string, unknown> | null,
  seed: () => number,
): SimulationSnapshot {
  if (
    value &&
    typeof value.seed === 'number' &&
    value.recipients !== null &&
    typeof value.recipients === 'object'
  ) {
    return value as SimulationSnapshot
  }
  return { ...(value ?? {}), seed: seed(), recipients: {} }
}

/** A decision still to apply: its recipient is in flight (`sent`, `deferred`). */
export function isPending(
  entry: RecipientDecisionEntry | undefined,
): entry is RecipientDecisionEntry {
  return entry !== undefined && entry.appliedAt === undefined
}
