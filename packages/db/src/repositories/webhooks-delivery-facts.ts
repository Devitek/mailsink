import { desc, inArray } from 'drizzle-orm'
import type { Executor } from '../client'
import { webhookAttempts } from '../schema/webhook-deliveries'
import { webhookEndpoints } from '../schema/webhooks'

/** What a delivery row does not hold: its endpoint's URL and its last attempt's duration. */
export interface WebhookDeliveryFacts {
  endpointUrl: string | null
  durationMs: number | null
}

/**
 * Facts of several deliveries in two queries (endpoint URLs, last attempt per delivery),
 * keyed by delivery id. A delivery without attempt has a null duration.
 */
export async function findWebhookDeliveryFacts(
  db: Executor,
  deliveries: readonly { id: string; endpointId: string }[],
): Promise<Map<string, WebhookDeliveryFacts>> {
  const facts = new Map<string, WebhookDeliveryFacts>()
  if (deliveries.length === 0) return facts
  const endpointIds = [...new Set(deliveries.map((d) => d.endpointId))]
  const [endpoints, attempts] = await Promise.all([
    db
      .select({ id: webhookEndpoints.id, url: webhookEndpoints.url })
      .from(webhookEndpoints)
      .where(inArray(webhookEndpoints.id, endpointIds)),
    db
      .selectDistinctOn([webhookAttempts.deliveryId], {
        deliveryId: webhookAttempts.deliveryId,
        durationMs: webhookAttempts.durationMs,
      })
      .from(webhookAttempts)
      .where(
        inArray(
          webhookAttempts.deliveryId,
          deliveries.map((d) => d.id),
        ),
      )
      .orderBy(webhookAttempts.deliveryId, desc(webhookAttempts.attemptNo)),
  ])
  const urls = new Map(endpoints.map((e) => [e.id, e.url]))
  const durations = new Map(attempts.map((a) => [a.deliveryId, a.durationMs]))
  for (const d of deliveries) {
    facts.set(d.id, {
      endpointUrl: urls.get(d.endpointId) ?? null,
      durationMs: durations.get(d.id) ?? null,
    })
  }
  return facts
}
