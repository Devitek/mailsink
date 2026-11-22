import { z } from 'zod'

// Mirrors the pg enums of packages/db (docs/architecture/02-database-schema.md).

export const DeliveryStatus = z.enum([
  'queued',
  'sent',
  'delivered',
  'deferred',
  'soft_bounce',
  'hard_bounce',
  'complained',
  'failed',
  'suppressed',
])

/** Final statuses the simulation can draw (queued, sent and suppressed are not drawn). */
export const SimulatedStatus = DeliveryStatus.exclude(['queued', 'sent', 'suppressed'])

/** Canonical webhook events (D22), see 03-contracts « Webhooks » for the per-format mapping. */
export const CanonicalEvent = z.enum([
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
])

export const ConnectionKind = z.enum(['resend', 'brevo', 'smtp'])
export const MessageSource = z.enum(['native', 'resend', 'brevo', 'smtp'])
export const EventType = z.enum([
  'accepted',
  'sent',
  'delivered',
  'deferred',
  'soft_bounce',
  'hard_bounce',
  'complained',
  'failed',
  'suppressed',
  'opened',
  'clicked',
])
export const EventOrigin = z.enum(['simulation', 'api', 'ui', 'mcp'])
export const RecipientKind = z.enum(['to', 'cc', 'bcc'])

export type DeliveryStatus = z.output<typeof DeliveryStatus>
export type SimulatedStatus = z.output<typeof SimulatedStatus>
export type CanonicalEvent = z.output<typeof CanonicalEvent>
export type ConnectionKind = z.output<typeof ConnectionKind>
export type MessageSource = z.output<typeof MessageSource>
export type EventType = z.output<typeof EventType>
export type EventOrigin = z.output<typeof EventOrigin>
export type RecipientKind = z.output<typeof RecipientKind>
