import type { SimulatedStatus } from '@mailsink/contracts'
import type { Executor, SimulatedMessage, SimulatedRecipient } from '@mailsink/db'

export interface RecipientOutcome {
  recipientId: string
  status: SimulatedStatus
  /** Stored in `message_recipients.status_reason` and the event data (e.g. matched rule). */
  reason?: string
}

export interface PlanInput {
  message: SimulatedMessage
  /** Recipients still `queued`: suppressed ones are never handed to the planner. */
  recipients: readonly SimulatedRecipient[]
}

/**
 * Decides the final status of each recipient. Runs inside the simulation transaction, with
 * the message row locked, so it may read settings through `db`.
 *
 * Extension point for #21: the settings resolver (connection override > workspace override
 * > connection settings > workspace settings), deterministic rules then weighted rates
 * become another planner passed to `simulateDelivery`. Latency is applied upstream (job
 * `run_at`); outcomes with side effects (suppressions, deferred retries) come with #21.
 */
export type DeliveryPlanner = (input: PlanInput, db: Executor) => Promise<RecipientOutcome[]>

/** Baseline simulation (roadmap phase 1): every recipient is delivered. */
export const baselinePlanner: DeliveryPlanner = async ({ recipients }) =>
  recipients.map((r) => ({ recipientId: r.id, status: 'delivered' }))
