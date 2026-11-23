import type { WebhookDelivery } from '@mailsink/db'
import { type EventBus, publishAll, type StreamFrame } from '../events/bus'
import { type DeliveryFacts, toDeliveryView } from './views'

/** A delivery to publish, with what its producer knows of its endpoint and last attempt. */
export interface PublishedDelivery extends Partial<DeliveryFacts> {
  delivery: WebhookDelivery
  connectionId: string | null
}

/**
 * `webhook.delivery` frame (derived: no SSE id, never replayed). Its `connectionId` is the
 * scope of the endpoint (null: Workspace scope), which the stream `connectionId` filter
 * reads.
 */
export function deliveryFrame(published: PublishedDelivery): StreamFrame {
  const { delivery, connectionId, endpointUrl = null, durationMs = null } = published
  return {
    id: null,
    connectionId,
    event: {
      type: 'webhook.delivery',
      delivery: toDeliveryView(delivery, { endpointUrl, durationMs }),
    },
  }
}

/** Publishes the deliveries on their workspace channel (skipped while nobody listens). */
export function publishDeliveries(
  bus: EventBus | undefined,
  workspaceId: string,
  deliveries: readonly PublishedDelivery[],
): void {
  if (!bus?.hasSubscribers(workspaceId) || deliveries.length === 0) return
  publishAll(bus, workspaceId, deliveries.map(deliveryFrame))
}
