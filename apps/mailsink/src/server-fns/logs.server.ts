import {
  ListApiLogsQuery,
  type ListApiLogsResponse,
  ListSmtpSessionsQuery,
  type ListSmtpSessionsResponse,
  type ListWebhookDeliveriesQuery,
  type ListWebhookDeliveriesResponse,
  type ReplayRequest,
  type SmtpSessionDetail,
  type WebhookDeliveryView,
} from '@mailsink/contracts'
import {
  getApiLogView,
  getSmtpSessionView,
  getWebhookDeliveryDetail,
  listApiLogViews,
  listSmtpSessionViews,
  listWebhookDeliveryViews,
  replayWebhookDelivery,
  toDeliveryView,
  webhookSecretPreview,
} from '@mailsink/core'
import {
  countWorkspaceLogs,
  findWebhookEndpoint,
  listConnections,
  listWebhookEndpoints,
} from '@mailsink/db'
import type { Runtime } from '../runtime/container'
import { checkSignature } from './logs-signature'
import type { InspectedApiLog, InspectedDelivery, LogSources } from './logs-types'
import { workspaceOfSlug } from './messages.server'

// Reads and the replay of the logs explorer (#41): the core services of the Capture log and
// delivery routes, scoped to the workspace of the URL, which they touch (D163).

export async function readLogSources(runtime: Runtime, slug: string): Promise<LogSources> {
  const { id } = await workspaceOfSlug(runtime, slug)
  const db = runtime.db.db
  const one = { page: 1, pageSize: 1 }
  const [connections, endpoints, api, smtp, all] = await Promise.all([
    listConnections(db, id),
    listWebhookEndpoints(db, id),
    listApiLogViews(db, id, ListApiLogsQuery.parse(one)),
    listSmtpSessionViews(db, id, ListSmtpSessionsQuery.parse(one)),
    countWorkspaceLogs(db, id),
  ])
  return {
    connections: connections.map(({ id, name, kind }) => ({ id, name, kind })),
    endpoints: endpoints.map(({ id, url, payloadFormat, connectionId }) => ({
      id,
      url,
      payloadFormat,
      connectionId,
    })),
    counts: {
      api: api.total,
      smtp: smtp.total,
      webhooks: Math.max(0, all - api.total - smtp.total),
    },
  }
}

export async function readApiLogs(
  runtime: Runtime,
  slug: string,
  query: ListApiLogsQuery,
): Promise<ListApiLogsResponse> {
  const { id } = await workspaceOfSlug(runtime, slug)
  return listApiLogViews(runtime.db.db, id, query)
}

const asText = (body: unknown): string | null => {
  if (body === null || body === undefined) return null
  return typeof body === 'string' ? body : JSON.stringify(body, null, 2)
}

export async function readApiLog(
  runtime: Runtime,
  slug: string,
  logId: string,
): Promise<InspectedApiLog> {
  const { id } = await workspaceOfSlug(runtime, slug)
  const log = await getApiLogView(runtime.db.db, id, logId)
  return { ...log, requestBody: asText(log.requestBody), responseBody: asText(log.responseBody) }
}

export async function readSmtpSessions(
  runtime: Runtime,
  slug: string,
  query: ListSmtpSessionsQuery,
): Promise<ListSmtpSessionsResponse> {
  const { id } = await workspaceOfSlug(runtime, slug)
  return listSmtpSessionViews(runtime.db.db, id, query)
}

export async function readSmtpSession(
  runtime: Runtime,
  slug: string,
  sessionId: string,
): Promise<SmtpSessionDetail> {
  const { id } = await workspaceOfSlug(runtime, slug)
  return getSmtpSessionView(runtime.db.db, id, sessionId)
}

export async function readDeliveries(
  runtime: Runtime,
  slug: string,
  query: ListWebhookDeliveriesQuery,
): Promise<ListWebhookDeliveriesResponse> {
  const { id } = await workspaceOfSlug(runtime, slug)
  return listWebhookDeliveryViews(runtime.db.db, id, query)
}

/** The delivery, its endpoint, and each attempt's signature checked with the current secret. */
export async function readDelivery(
  runtime: Runtime,
  slug: string,
  deliveryId: string,
): Promise<InspectedDelivery> {
  const { id } = await workspaceOfSlug(runtime, slug)
  const delivery = await getWebhookDeliveryDetail(runtime.db.db, id, deliveryId)
  const endpoint = await findWebhookEndpoint(runtime.db.db, id, delivery.endpointId)
  const secrets = endpoint && {
    secret: endpoint.secret,
    brevoAuth: endpoint.brevoAuth,
    customHeaders: endpoint.customHeaders,
  }
  return {
    ...delivery,
    attempts: delivery.attempts.map((attempt) => ({
      ...attempt,
      signature: secrets
        ? checkSignature({ ...delivery, headers: attempt.requestHeaders, endpoint: secrets })
        : 'missing',
    })),
    endpoint: endpoint
      ? {
          id: endpoint.id,
          url: endpoint.url,
          payloadFormat: endpoint.payloadFormat,
          connectionId: endpoint.connectionId,
          secretPreview:
            endpoint.secret && endpoint.payloadFormat !== 'brevo'
              ? webhookSecretPreview(endpoint.secret)
              : null,
        }
      : null,
  }
}

/** Replay (D139): a new pending delivery, published on the bus like the Capture route. */
export async function replayDelivery(
  runtime: Runtime,
  slug: string,
  deliveryId: string,
  request: ReplayRequest,
): Promise<WebhookDeliveryView> {
  const { id } = await workspaceOfSlug(runtime, slug)
  const replay = await replayWebhookDelivery(runtime.db.db, id, deliveryId, request, {
    bus: runtime.bus,
  })
  return toDeliveryView(replay)
}
