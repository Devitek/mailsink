import type {
  CanonicalEvent,
  WebhookAttemptView,
  WebhookDeliveryDetail,
  WebhookDeliveryView,
  WebhookEndpointView,
} from '@mailsink/contracts'
import type { WebhookAttempt, WebhookDelivery, WebhookEndpoint } from '@mailsink/db'
import { dialectNames, sortCanonical, unsupportedEvents } from './formatters/events-map'
import { webhookSecretPreview } from './secret'

export function toEndpointView(row: WebhookEndpoint): WebhookEndpointView {
  const canonical = sortCanonical(row.events as CanonicalEvent[])
  const username =
    row.brevoAuth === 'basic' && row.secret ? row.secret.slice(0, row.secret.indexOf(':')) : null
  return {
    id: row.id,
    numericId: row.numericId,
    connectionId: row.connectionId,
    url: row.url,
    payloadFormat: row.payloadFormat,
    events: dialectNames(row.payloadFormat, canonical),
    canonicalEvents: canonical,
    unsupportedEvents: unsupportedEvents(row.payloadFormat, canonical),
    description: row.description,
    brevoAuth: username !== null ? { type: 'basic', username } : { type: row.brevoAuth },
    customHeaders: row.customHeaders,
    secretPreview:
      row.payloadFormat !== 'brevo' && row.secret ? webhookSecretPreview(row.secret) : null,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toDeliveryView(row: WebhookDelivery): WebhookDeliveryView {
  return {
    id: row.id,
    endpointId: row.endpointId,
    messageId: row.messageId,
    eventId: row.eventId,
    payloadFormat: row.payloadFormat,
    canonicalEvent: row.canonicalEvent,
    dialectEvent: row.dialectEvent,
    recipient: row.recipient,
    status: row.status,
    attemptCount: row.attemptCount,
    nextAttemptAt: row.nextAttemptAt?.toISOString() ?? null,
    lastStatusCode: row.lastStatusCode,
    replayOf: row.replayOf,
    replayMode: row.replayMode,
    createdAt: row.createdAt.toISOString(),
  }
}

export function toAttemptView(row: WebhookAttempt): WebhookAttemptView {
  return {
    id: row.id,
    attemptNo: row.attemptNo,
    requestHeaders: row.requestHeaders,
    signedAt: row.signedAt,
    responseStatus: row.responseStatus,
    responseBody: row.responseBody,
    durationMs: row.durationMs,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
  }
}

export function toDeliveryDetail(
  row: WebhookDelivery,
  attempts: readonly WebhookAttempt[],
): WebhookDeliveryDetail {
  return {
    ...toDeliveryView(row),
    body: row.body,
    contentType: row.contentType,
    attempts: attempts.map(toAttemptView),
  }
}
