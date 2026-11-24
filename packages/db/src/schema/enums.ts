import { pgEnum } from 'drizzle-orm/pg-core'

export const connectionKind = pgEnum('connection_kind', ['resend', 'brevo', 'smtp'])
export const messageSource = pgEnum('message_source', ['native', 'resend', 'brevo', 'smtp'])
export const deliveryStatus = pgEnum('delivery_status', [
  'queued',
  'sent',
  'delivered',
  'deferred',
  'soft_bounce',
  'hard_bounce',
  'complained',
  'failed',
  'invalid',
  'suppressed',
])
export const eventType = pgEnum('event_type', [
  'accepted',
  'sent',
  'delivered',
  'deferred',
  'soft_bounce',
  'hard_bounce',
  'complained',
  'failed',
  'invalid',
  'suppressed',
  'opened',
  'clicked',
])
export const eventOrigin = pgEnum('event_origin', ['simulation', 'api', 'ui', 'mcp'])
export const recipientKind = pgEnum('recipient_kind', ['to', 'cc', 'bcc'])
export const apiKeyScope = pgEnum('api_key_scope', ['workspace', 'connection'])
export const suppressionReason = pgEnum('suppression_reason', [
  'hard_bounce',
  'complained',
  'manual',
])
// Outgoing webhook dialect, decoupled from the ingestion channel (D20).
export const payloadFormat = pgEnum('payload_format', ['unified', 'resend', 'brevo'])
// Canonical webhook events, the only form stored (D22). Dialect names are mapped at the
// edges (API, UI, emitted payload), see 03-contracts.md « Webhooks ».
export const webhookEvent = pgEnum('webhook_event', [
  'email.sent',
  'email.delivered',
  'email.deferred',
  'email.soft_bounced',
  'email.hard_bounced',
  'email.complained',
  'email.opened',
  'email.clicked',
  'email.suppressed',
  'email.failed',
  'email.invalid',
])
export const brevoAuthType = pgEnum('brevo_auth_type', ['none', 'bearer', 'basic'])
export const replayMode = pgEnum('replay_mode', ['exact', 'resign'])
export const webhookDeliveryStatus = pgEnum('webhook_delivery_status', [
  'pending',
  'retrying',
  'succeeded',
  'failed',
])
export const apiDialect = pgEnum('api_dialect', [
  'native',
  'resend',
  'brevo',
  'admin',
  'capture',
  'mcp',
])
export const smtpOutcome = pgEnum('smtp_outcome', ['accepted', 'rejected', 'auth_failed', 'error'])
