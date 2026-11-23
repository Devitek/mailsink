import { createHmac } from 'node:crypto'
import type { UnifiedWebhookPayload } from '@mailsink/contracts'
import { formatAddress, JSON_CONTENT_TYPE, withCustomHeaders } from './shared'
import type { WebhookFormatter } from './types'

/** hex HMAC-SHA256 of `"<timestamp>.<body>"`, keyed with the whole `whsec_…` string (D24). */
export function unifiedSignature(secret: string, timestamp: number, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
}

export const unifiedFormatter: WebhookFormatter = {
  format: 'unified',
  eventName: (canonical) => canonical,
  serialize({ delivery, workspace, connection, message, event }) {
    const payload: UnifiedWebhookPayload = {
      id: delivery.id,
      event: event.canonical,
      occurredAt: event.occurredAt.toISOString(),
      workspaceId: workspace.id,
      connectionId: connection?.id ?? null,
      connectionKind: connection?.kind ?? null,
      messageId: message.id,
      providerMessageId: message.providerMessageId,
      recipient: event.recipient,
      from: formatAddress(message.from),
      to: message.to,
      subject: message.subject,
      tags: message.tags,
      metadata: message.metadata,
      detail: event.detail,
    }
    return JSON.stringify(payload)
  },
  sign({ deliveryId, body, endpoint, timestamp, canonical }) {
    if (!endpoint.secret) throw new Error('unified endpoint without a secret')
    return withCustomHeaders(endpoint, {
      'Content-Type': JSON_CONTENT_TYPE,
      'X-Mailsink-Event': canonical,
      'X-Mailsink-Delivery-Id': deliveryId,
      'X-Mailsink-Timestamp': String(timestamp),
      'X-Mailsink-Signature': `sha256=${unifiedSignature(endpoint.secret, timestamp, body)}`,
    })
  },
}
