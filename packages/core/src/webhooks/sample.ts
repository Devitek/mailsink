import type { CanonicalEvent, ConnectionKind } from '@mailsink/contracts'
import type { MessageForWebhook, WebhookContext, WebhookEventDetail } from './formatters/types'

// Sample event of the preview (`POST /capture/webhooks/preview`) and of the test send
// (`POST /capture/webhooks/:id/test`, B1-2): built by the real formatters.

export const SAMPLE_MESSAGE_ID = 'msg_00000000-0000-7000-8000-000000000000'

export function sampleMessage(now: Date): MessageForWebhook {
  return {
    id: SAMPLE_MESSAGE_ID,
    providerMessageId: '00000000-0000-7000-8000-000000000000',
    source: 'native',
    from: { email: 'app@example.com', name: 'Example App' },
    to: ['jane@example.com'],
    subject: 'Mailsink test event',
    tags: [{ name: 'category', value: 'test' }],
    headers: {},
    metadata: {},
    templateId: null,
    createdAt: now,
  }
}

const SAMPLE_DETAIL: Partial<Record<CanonicalEvent, WebhookEventDetail>> = {
  'email.hard_bounced': { reason: 'The recipient address does not exist.', smtpCode: 550 },
  'email.soft_bounced': { reason: 'Mailbox full', smtpCode: 452 },
  'email.deferred': { reason: 'Greylisted', smtpCode: 451 },
  'email.failed': { reason: 'Simulated failure' },
  'email.suppressed': { reason: 'Address on the suppression list' },
  'email.opened': { userAgent: 'Mozilla/5.0 (Mailsink test)' },
  'email.clicked': { url: 'https://example.com/', userAgent: 'Mozilla/5.0 (Mailsink test)' },
}

export interface SampleContextInput {
  canonical: CanonicalEvent
  deliveryId: string
  numericEndpointId: number
  workspace: WebhookContext['workspace']
  connection: { id: string; kind: ConnectionKind } | null
  now: Date
}

export function sampleContext(input: SampleContextInput): WebhookContext {
  const message = sampleMessage(input.now)
  return {
    delivery: { id: input.deliveryId, numericEndpointId: input.numericEndpointId },
    workspace: input.workspace,
    connection: input.connection,
    message,
    event: {
      canonical: input.canonical,
      occurredAt: input.now,
      recipient: message.to[0] ?? null,
      detail: SAMPLE_DETAIL[input.canonical] ?? {},
    },
  }
}
