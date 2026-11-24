import type { CanonicalEvent, ConnectionKind, PayloadFormat } from '@mailsink/contracts'

// Formatter strategy (03-contracts, « Formatter strategy », D21): one formatter per
// payload format, shared by the dispatcher, the replay, the preview and the test send.

export interface MessageForWebhook {
  id: string
  providerMessageId: string
  source: 'native' | 'resend' | 'brevo' | 'smtp'
  from: { email: string; name?: string | null }
  to: string[]
  subject: string
  tags: { name: string; value: string }[]
  /** Headers kept at ingestion (`X-Mailin-custom` of the Brevo format). */
  headers: Record<string, string>
  metadata: Record<string, unknown>
  templateId: number | null
  createdAt: Date
}

export interface WebhookEventDetail {
  reason?: string
  smtpCode?: number
  url?: string
  userAgent?: string
}

export interface WebhookContext {
  delivery: { id: string; numericEndpointId: number }
  workspace: { id: string; slug: string; timezone: string }
  connection: { id: string; kind: ConnectionKind } | null
  message: MessageForWebhook
  event: {
    canonical: CanonicalEvent
    occurredAt: Date
    recipient: string | null
    detail: WebhookEventDetail
  }
}

/** What signing needs from the endpoint (D11: secrets stored in clear). */
export interface EndpointSecrets {
  /** unified / resend: the `whsec_` secret; brevo: bearer token or "user:password". */
  secret: string | null
  brevoAuth: 'none' | 'bearer' | 'basic'
  customHeaders: readonly { key: string; value: string }[]
}

export interface SignInput {
  deliveryId: string
  body: string
  endpoint: EndpointSecrets
  /** Unix seconds of this attempt. */
  timestamp: number
  canonical: CanonicalEvent
}

export interface WebhookFormatter {
  readonly format: PayloadFormat
  /** Emitted name, or null when this format has no equivalent (delivery skipped). */
  eventName(canonical: CanonicalEvent): string | null
  /** Serialized once per delivery; the stored string is what is signed and sent. */
  serialize(ctx: WebhookContext): string
  /** Called per attempt; returns every header to send (content-type included). */
  sign(input: SignInput): Record<string, string>
}
