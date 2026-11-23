import type { SimulatedStatus } from '@mailsink/contracts'
import type { Executor, SimulatedMessage, SimulatedRecipient } from '@mailsink/db'

export interface RecipientOutcome {
  recipientId: string
  status: SimulatedStatus
  /** Stored in `message_recipients.status_reason` and the event data (e.g. matched rule). */
  reason?: string
  /** Delay between the decision and the final status (latency or rule `delayMs`). */
  delayMs?: number
  /** Event `data.smtpCode` of the final status (rule `smtpCode`). */
  smtpCode?: number
  /** Kept as is in the decision snapshot (draw source, matched rule). */
  detail?: Record<string, unknown>
}

export interface PlanRecipient extends SimulatedRecipient {
  /** 0 for the first decision, then the number of `deferred` already applied. */
  attempt: number
}

export interface PlanInput {
  message: SimulatedMessage
  /**
   * Recipients to decide: `queued` ones (attempt 0) and `deferred` ones being re-queued.
   * Suppressed recipients are never handed to the planner.
   */
  recipients: readonly PlanRecipient[]
  /** Seed of the message (stored in the snapshot): same seed, same decisions. */
  seed: number
  /** Decision instant (epoch ms). */
  now: number
}

export interface DeliveryPlan {
  outcomes: RecipientOutcome[]
  /** Merged into the decision snapshot (`messages.simulation`): override ids, sources. */
  context?: Record<string, unknown>
}

/**
 * Decides the final status of each recipient. Runs inside the simulation transaction, with
 * the message row locked, so it may read settings through `db`. The default planner is the
 * settings planner (`settings-planner.ts`, #21); side effects (latency, deferred re-queue,
 * suppressions) are applied by `simulateDelivery` from the outcomes.
 */
export type DeliveryPlanner = (input: PlanInput, db: Executor) => Promise<DeliveryPlan>

/** Baseline simulation (roadmap phase 1): every recipient is delivered at once. */
export const baselinePlanner: DeliveryPlanner = async ({ recipients }) => ({
  outcomes: recipients.map((r) => ({ recipientId: r.id, status: 'delivered' })),
})
