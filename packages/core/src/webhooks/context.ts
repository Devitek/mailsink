import type { CanonicalEvent } from '@mailsink/contracts'
import type { WebhookEndpoint, WebhookMessageRow, WebhookWorkspaceRow } from '@mailsink/db'
import type { EndpointSecrets, WebhookContext, WebhookEventDetail } from './formatters/types'

export interface ContextEvent {
  canonical: CanonicalEvent
  occurredAt: Date
  recipient: string | null
  detail: WebhookEventDetail | null
}

export function buildContext(
  deliveryId: string,
  endpoint: Pick<WebhookEndpoint, 'numericId'>,
  workspace: WebhookWorkspaceRow,
  message: WebhookMessageRow,
  event: ContextEvent,
): WebhookContext {
  return {
    delivery: { id: deliveryId, numericEndpointId: endpoint.numericId },
    workspace,
    connection:
      message.connectionId && message.connectionKind
        ? { id: message.connectionId, kind: message.connectionKind }
        : null,
    message,
    event: { ...event, detail: event.detail ?? {} },
  }
}

export function endpointSecrets(endpoint: WebhookEndpoint): EndpointSecrets {
  return {
    secret: endpoint.secret,
    brevoAuth: endpoint.brevoAuth,
    customHeaders: endpoint.customHeaders,
  }
}
