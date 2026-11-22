import { type SimulateDeliveryOptions, simulateDelivery } from '../../simulation/simulate-delivery'
import { type JobHandler, PermanentJobError } from '../queue'

/** Payload enqueued by ingestion, in the same transaction as the message. */
export interface SimulateDeliveryPayload {
  messageId: string
}

function parsePayload(payload: unknown): SimulateDeliveryPayload {
  const messageId = (payload as { messageId?: unknown } | null)?.messageId
  if (typeof messageId !== 'string' || messageId === '') {
    throw new PermanentJobError('simulate_delivery payload needs a messageId string')
  }
  return { messageId }
}

/**
 * `simulate_delivery` job: runs the simulation of the message. A message deleted in the
 * meantime (retention, workspace GC) completes the job without effect. `options.planner`
 * is where #21 plugs the settings resolver.
 */
export function simulateDeliveryHandler(options: SimulateDeliveryOptions = {}): JobHandler {
  return async (job, { db }) => {
    const { messageId } = parsePayload(job.payload)
    await simulateDelivery(db, messageId, options)
  }
}
