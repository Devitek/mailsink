import type { EventBus } from '../../events/bus'
import { type AttemptOptions, runAttempt } from '../../webhooks/attempt'
import { parseDeliverPayload } from '../../webhooks/jobs'
import { publishDeliveries } from '../../webhooks/publish'
import type { JobHandler } from '../queue'

export interface DeliverWebhookOptions extends AttemptOptions {
  /** Receives one `webhook.delivery` frame per attempt. */
  bus?: EventBus
}

/**
 * `deliver_webhook` job: one attempt of one delivery. The retry schedule is the
 * delivery's own (8 attempts, D24): a failed attempt enqueues the next job itself, so the
 * handler only throws on infrastructure errors (database), which the queue retries.
 */
export function deliverWebhookHandler(options: DeliverWebhookOptions = {}): JobHandler {
  return async (job, { db }) => {
    const payload = parseDeliverPayload(job.payload)
    const outcome = await runAttempt(db, payload, options)
    if (!outcome) return
    publishDeliveries(options.bus, job.workspaceId, [
      {
        delivery: outcome.delivery,
        connectionId: outcome.endpoint.connectionId,
        endpointUrl: outcome.endpoint.url,
        durationMs: outcome.attempt.durationMs,
      },
    ])
  }
}
