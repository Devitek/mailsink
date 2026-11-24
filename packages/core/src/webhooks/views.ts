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
import { redactUrl } from './url-credentials'

export function toEndpointView(row: WebhookEndpoint): WebhookEndpointView {
  const canonical = sortCanonical(row.events as CanonicalEvent[])
  const username =
    row.brevoAuth === 'basic' && row.secret ? row.secret.slice(0, row.secret.indexOf(':')) : null
  return {
    id: row.id,
    numericId: row.numericId,
    connectionId: row.connectionId,
    url: redactUrl(row.url), // a row stored before D278 may hold credentials
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

/** What a delivery row does not hold: its endpoint URL and the duration of its last try. */
export interface DeliveryFacts {
  endpointUrl: string | null
  durationMs: number | null
}

const noFacts: DeliveryFacts = { endpointUrl: null, durationMs: null }

export function toDeliveryView(
  row: WebhookDelivery,
  facts: DeliveryFacts = noFacts,
): WebhookDeliveryView {
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
    endpointUrl: facts.endpointUrl === null ? null : redactUrl(facts.endpointUrl),
    durationMs: facts.durationMs,
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
  endpointUrl: string | null,
): WebhookDeliveryDetail {
  const last = attempts.reduce<WebhookAttempt | undefined>(
    (a, b) => (a && a.attemptNo > b.attemptNo ? a : b),
    undefined,
  )
  return {
    ...toDeliveryView(row, { endpointUrl, durationMs: last?.durationMs ?? null }),
    body: row.body,
    contentType: row.contentType,
    attempts: attempts.map(toAttemptView),
  }
}
