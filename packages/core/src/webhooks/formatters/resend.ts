import { createHmac } from 'node:crypto'
import type { ResendWebhookPayload } from '@mailsink/contracts'
import { toDialect } from './events-map'
import { formatAddress, JSON_CONTENT_TYPE, messageUuid, withCustomHeaders } from './shared'
import type { WebhookFormatter } from './types'

/** Svix `v1,<base64>` signature of `"<id>.<timestamp>.<body>"` (key: base64 after whsec_). */
export function svixSignature(secret: string, id: string, timestamp: number, body: string): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const mac = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64')
  return `v1,${mac}`
}

type ResendType = ResendWebhookPayload['type']

export const resendFormatter: WebhookFormatter = {
  format: 'resend',
  eventName: (canonical) => toDialect('resend', canonical),
  serialize({ message, event }) {
    const type = toDialect('resend', event.canonical) as ResendType | null
    if (!type) throw new Error(`resend cannot emit ${event.canonical}`)
    const { detail } = event
    const data: ResendWebhookPayload['data'] = {
      email_id: messageUuid(message),
      from: formatAddress(message.from),
      to: message.to,
      subject: message.subject,
      created_at: message.createdAt.toISOString(),
    }
    if (message.tags.length > 0) {
      data.tags = Object.fromEntries(message.tags.map((t) => [t.name, t.value]))
    }
    if (event.canonical === 'email.hard_bounced') {
      data.bounce = {
        message: detail.reason ?? 'The recipient address does not exist.',
        type: 'Permanent',
        subType: 'General',
      }
    }
    if (event.canonical === 'email.clicked') {
      data.click = {
        link: detail.url ?? '',
        ipAddress: '127.0.0.1',
        userAgent: detail.userAgent ?? 'Mailsink',
        timestamp: event.occurredAt.toISOString(),
      }
    }
    if (event.canonical === 'email.failed') {
      data.failed = { reason: detail.reason ?? 'Simulated failure' }
    }
    if (event.canonical === 'email.invalid') {
      data.failed = { reason: detail.reason ?? 'Invalid recipient address' }
    }
    const payload: ResendWebhookPayload = {
      type,
      created_at: event.occurredAt.toISOString(),
      data,
    }
    return JSON.stringify(payload)
  },
  sign({ deliveryId, body, endpoint, timestamp }) {
    if (!endpoint.secret) throw new Error('resend endpoint without a secret')
    return withCustomHeaders(endpoint, {
      'Content-Type': JSON_CONTENT_TYPE,
      'svix-id': deliveryId,
      'svix-timestamp': String(timestamp),
      'svix-signature': svixSignature(endpoint.secret, deliveryId, timestamp, body),
    })
  },
}
