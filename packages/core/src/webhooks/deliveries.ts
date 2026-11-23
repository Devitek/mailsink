import type {
  ListWebhookDeliveriesQuery,
  ListWebhookDeliveriesResponse,
  ReplayRequest,
  WebhookDeliveryDetail,
  WebhookDeliveryView,
} from '@mailsink/contracts'
import {
  type Database,
  type Executor,
  enqueueJobs,
  findWebhookDelivery,
  findWebhookDeliveryFacts,
  findWebhookEndpoint,
  insertWebhookDeliveries,
  listWebhookAttempts,
  listWebhookDeliveries,
  newId,
  type WebhookDelivery,
} from '@mailsink/db'
import { DomainError } from '../errors'
import type { EventBus } from '../events/bus'
import { deliverWebhookJob } from './jobs'
import { publishDeliveries } from './publish'
import { toDeliveryDetail, toDeliveryView } from './views'

const deliveryNotFound = () => new DomainError('not_found', 'Webhook delivery not found')

/** Views of delivery rows with their endpoint URL and last attempt duration. */
export async function toDeliveryViews(
  db: Executor,
  rows: readonly WebhookDelivery[],
): Promise<WebhookDeliveryView[]> {
  const facts = await findWebhookDeliveryFacts(db, rows)
  return rows.map((row) => toDeliveryView(row, facts.get(row.id)))
}

/** `GET /capture/webhooks/deliveries`: newest first, keyset cursor (the last id). */
export async function listWebhookDeliveryViews(
  db: Executor,
  workspaceId: string,
  query: ListWebhookDeliveriesQuery,
): Promise<ListWebhookDeliveriesResponse> {
  const rows = await listWebhookDeliveries(db, workspaceId, {
    endpointId: query.endpointId,
    payloadFormat: query.payloadFormat,
    messageId: query.messageId,
    status: query.status,
    after: query.cursor,
    limit: query.limit + 1,
  })
  const page = rows.slice(0, query.limit)
  const last = page.at(-1)
  return {
    data: await toDeliveryViews(db, page),
    nextCursor: rows.length > query.limit && last ? last.id : null,
  }
}

/** Deliveries of one message, newest first (`MessageDetail.webhookDeliveries`). */
export async function listMessageWebhookDeliveries(
  db: Executor,
  workspaceId: string,
  messageId: string,
): Promise<WebhookDeliveryView[]> {
  const rows = await listWebhookDeliveries(db, workspaceId, { messageId, limit: 200 })
  return toDeliveryViews(db, rows)
}

export async function getWebhookDeliveryDetail(
  db: Executor,
  workspaceId: string,
  id: string,
): Promise<WebhookDeliveryDetail> {
  const row = await findWebhookDelivery(db, workspaceId, id)
  if (!row) throw deliveryNotFound()
  const [attempts, endpoint] = await Promise.all([
    listWebhookAttempts(db, row.id),
    findWebhookEndpoint(db, workspaceId, row.endpointId),
  ])
  return toDeliveryDetail(row, attempts, endpoint?.url ?? null)
}

/**
 * Replay (D24, step 4): a new delivery (`replayOf` = the original, a replay of a replay
 * points to the first one) with the same body bytes, sent by a `deliver_webhook` job.
 * `exact` copies the headers of an attempt (default: the last one), signature included;
 * `resign` signs again with a fresh timestamp and the original delivery id.
 */
export async function replayWebhookDelivery(
  db: Database,
  workspaceId: string,
  id: string,
  request: ReplayRequest,
  options: { bus?: EventBus } = {},
): Promise<WebhookDelivery> {
  const source = await findWebhookDelivery(db, workspaceId, id)
  if (!source) throw deliveryNotFound()
  const endpoint = await findWebhookEndpoint(db, workspaceId, source.endpointId)
  if (!endpoint) throw deliveryNotFound()
  let exactAttemptId: string | undefined
  if (request.mode === 'exact') {
    const attempts = await listWebhookAttempts(db, source.id)
    const copied = request.attemptId
      ? attempts.find((a) => a.id === request.attemptId)
      : attempts.at(-1)
    if (request.attemptId && !copied) throw new DomainError('not_found', 'Attempt not found')
    if (!copied) {
      throw new DomainError('conflict', 'This delivery has no attempt to copy; use mode resign')
    }
    exactAttemptId = copied.id
  }
  const replay = await db.transaction(async (tx) => {
    const [replay] = await insertWebhookDeliveries(tx, [
      {
        id: newId('whd'),
        workspaceId,
        endpointId: source.endpointId,
        eventId: source.eventId,
        messageId: source.messageId,
        payloadFormat: source.payloadFormat,
        canonicalEvent: source.canonicalEvent,
        dialectEvent: source.dialectEvent,
        recipient: source.recipient,
        body: source.body,
        contentType: source.contentType,
        replayOf: source.replayOf ?? source.id,
        replayMode: request.mode,
      },
    ])
    if (!replay) throw new Error('replay not inserted')
    await enqueueJobs(tx, [deliverWebhookJob(replay, { attemptNo: 1, exactAttemptId })])
    return replay
  })
  publishDeliveries(options.bus, workspaceId, [
    { delivery: replay, connectionId: endpoint.connectionId, endpointUrl: endpoint.url },
  ])
  return replay
}
