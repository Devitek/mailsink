import type { CanonicalEvent } from '@mailsink/contracts'
import {
  type Executor,
  enqueueJobs,
  findWebhookMessage,
  findWebhookWorkspace,
  hasEnabledWebhookEndpoints,
  insertWebhookDeliveries,
  listEndpointsInScope,
  type MessageEventRow,
  type NewWebhookDelivery,
  newId,
  type WebhookDelivery,
  type WebhookMessageRow,
} from '@mailsink/db'
import { buildContext } from './context'
import { formatters } from './formatters'
import { canonicalOfEventType } from './formatters/events-map'
import { deliverWebhookJob } from './jobs'

/** A created delivery and the scope of its endpoint (stream frame filter). */
export interface FannedOut {
  delivery: WebhookDelivery
  connectionId: string | null
  endpointUrl: string
}

export type FanOutEvent = Pick<
  MessageEventRow,
  'id' | 'workspaceId' | 'messageId' | 'recipientEmail' | 'type' | 'data' | 'occurredAt'
>

/**
 * Fan-out (D24, step 1 and 2): every event of the workspace's messages goes to each enabled
 * endpoint whose scope covers the message connection (that connection or Workspace), whose
 * canonical subscription contains the event and whose format emits it. The ingestion
 * channel plays no part (D20). Each delivery body is serialized once and stored, with one
 * `deliver_webhook` job for its first attempt. Run it in the caller's transaction.
 */
export async function fanOutEvents(
  db: Executor,
  workspaceId: string,
  events: readonly FanOutEvent[],
): Promise<FannedOut[]> {
  const emitted = events.flatMap((e) => {
    const canonical = canonicalOfEventType(e.type)
    return canonical && e.workspaceId === workspaceId ? [{ row: e, canonical }] : []
  })
  if (emitted.length === 0 || !(await hasEnabledWebhookEndpoints(db, workspaceId))) return []
  const workspace = await findWebhookWorkspace(db, workspaceId)
  if (!workspace) return []
  const messages = new Map<string, WebhookMessageRow | undefined>()
  const scopes = new Map<string, Awaited<ReturnType<typeof listEndpointsInScope>>>()
  const rows: NewWebhookDelivery[] = []
  const scopeOf = new Map<string, string | null>()
  const urlOf = new Map<string, string>()
  for (const { row, canonical } of emitted) {
    if (!messages.has(row.messageId)) {
      messages.set(row.messageId, await findWebhookMessage(db, workspaceId, row.messageId))
    }
    const message = messages.get(row.messageId)
    if (!message) continue
    const scopeKey = message.connectionId ?? ''
    if (!scopes.has(scopeKey)) {
      scopes.set(scopeKey, await listEndpointsInScope(db, workspaceId, message.connectionId))
    }
    for (const endpoint of scopes.get(scopeKey) ?? []) {
      if (!subscribed(endpoint.events, canonical)) continue
      const formatter = formatters[endpoint.payloadFormat]
      const dialectEvent = formatter.eventName(canonical)
      if (!dialectEvent) continue
      const id = newId('whd')
      scopeOf.set(id, endpoint.connectionId)
      urlOf.set(id, endpoint.url)
      const ctx = buildContext(id, endpoint, workspace, message, {
        canonical,
        occurredAt: row.occurredAt,
        recipient: row.recipientEmail,
        detail: row.data,
      })
      rows.push({
        id,
        workspaceId,
        endpointId: endpoint.id,
        eventId: row.id,
        messageId: row.messageId,
        payloadFormat: endpoint.payloadFormat,
        canonicalEvent: canonical,
        dialectEvent,
        recipient: row.recipientEmail,
        body: formatter.serialize(ctx),
      })
    }
  }
  const deliveries = await insertWebhookDeliveries(db, rows)
  await enqueueJobs(
    db,
    deliveries.map((d) => deliverWebhookJob(d, { attemptNo: 1 })),
  )
  return deliveries.map((delivery) => ({
    delivery,
    connectionId: scopeOf.get(delivery.id) ?? null,
    endpointUrl: urlOf.get(delivery.id) ?? '',
  }))
}

const subscribed = (events: readonly string[], canonical: CanonicalEvent) =>
  events.includes(canonical)
