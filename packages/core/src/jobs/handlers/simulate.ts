import { type SimulateDeliveryOptions, simulateDelivery } from '../../simulation/simulate-delivery'
import { type JobHandler, PermanentJobError } from '../queue'
import {
  type PublishSimulationOptions,
  publishSimulation,
  snapshotEventIds,
} from './simulate-publish'

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
 * meantime (retention, workspace GC) completes the job without effect. The planner
 * defaults to the settings planner (#21); a run with decisions still pending (latency,
 * deferred retry) enqueues its own follow-up job. `options.bus` receives the
 * transitions (D6).
 */
export function simulateDeliveryHandler(
  options: SimulateDeliveryOptions & PublishSimulationOptions = {},
): JobHandler {
  return async (job, { db }) => {
    const { messageId } = parsePayload(job.payload)
    const before = await snapshotEventIds(db, job.workspaceId, messageId, options)
    const result = await simulateDelivery(db, messageId, options)
    await publishSimulation(db, job.workspaceId, messageId, result, before, options)
  }
}
