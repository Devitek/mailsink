import type { NewJob, WebhookDelivery } from '@mailsink/db'
import { PermanentJobError } from '../jobs/queue'

/** Payload of a `deliver_webhook` job: one attempt of one delivery. */
export interface DeliverWebhookPayload {
  deliveryId: string
  /** 1-based; a job whose attempt is already recorded completes without effect. */
  attemptNo: number
  /** `exact` replay: every attempt sends the headers of this attempt byte for byte. */
  exactAttemptId?: string
}

export function deliverWebhookJob(
  delivery: Pick<WebhookDelivery, 'id' | 'workspaceId'>,
  options: Omit<DeliverWebhookPayload, 'deliveryId'> & { runAt?: Date },
): NewJob {
  const { runAt, ...rest } = options
  const payload: DeliverWebhookPayload = { deliveryId: delivery.id, ...rest }
  return {
    kind: 'deliver_webhook',
    workspaceId: delivery.workspaceId,
    payload,
    ...(runAt ? { runAt } : {}),
  }
}

export function parseDeliverPayload(payload: unknown): DeliverWebhookPayload {
  const p = (payload ?? {}) as Partial<DeliverWebhookPayload>
  if (typeof p.deliveryId !== 'string' || !Number.isInteger(p.attemptNo)) {
    throw new PermanentJobError('deliver_webhook payload needs deliveryId and attemptNo')
  }
  return {
    deliveryId: p.deliveryId,
    attemptNo: p.attemptNo as number,
    ...(typeof p.exactAttemptId === 'string' ? { exactAttemptId: p.exactAttemptId } : {}),
  }
}
