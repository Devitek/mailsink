import type { WebhookDelivery } from '@mailsink/db'
import { type EventBus, publishAll, type StreamFrame } from '../events/bus'
import { toDeliveryView } from './views'

/**
 * `webhook.delivery` frame (derived: no SSE id, never replayed). Its `connectionId` is the
 * scope of the endpoint (null: Workspace scope), which the stream `connectionId` filter
 * reads.
 */
export function deliveryFrame(delivery: WebhookDelivery, connectionId: string | null): StreamFrame {
  return {
    id: null,
    connectionId,
    event: { type: 'webhook.delivery', delivery: toDeliveryView(delivery) },
  }
}

/** Publishes the deliveries on their workspace channel (skipped while nobody listens). */
export function publishDeliveries(
  bus: EventBus | undefined,
  workspaceId: string,
  deliveries: readonly { delivery: WebhookDelivery; connectionId: string | null }[],
): void {
  if (!bus?.hasSubscribers(workspaceId) || deliveries.length === 0) return
  publishAll(
    bus,
    workspaceId,
    deliveries.map((d) => deliveryFrame(d.delivery, d.connectionId)),
  )
}
