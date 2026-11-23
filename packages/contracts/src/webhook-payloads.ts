import { z } from 'zod'
import { Tag } from './common'
import { CanonicalEvent } from './status'

// Bodies emitted by the three formatters (03-contracts, « Formatter strategy », D21).

export const UnifiedWebhookPayload = z.object({
  id: z.string(), // whd_…
  event: CanonicalEvent,
  occurredAt: z.iso.datetime(),
  workspaceId: z.string(),
  connectionId: z.string().nullable(),
  connectionKind: z.enum(['resend', 'brevo', 'smtp']).nullable(), // null: native API
  messageId: z.string(), // msg_…
  providerMessageId: z.string(),
  recipient: z.string().nullable(),
  from: z.string(),
  to: z.array(z.string()),
  subject: z.string(),
  tags: z.array(Tag),
  metadata: z.record(z.string(), z.unknown()),
  detail: z.object({
    reason: z.string().optional(),
    smtpCode: z.number().optional(),
    url: z.string().optional(),
    userAgent: z.string().optional(),
  }),
})

export const ResendWebhookPayload = z.object({
  type: z.enum([
    'email.sent',
    'email.delivered',
    'email.delivery_delayed',
    'email.complained',
    'email.bounced',
    'email.opened',
    'email.clicked',
    'email.failed',
  ]),
  created_at: z.iso.datetime(),
  data: z.object({
    email_id: z.string(),
    from: z.string(),
    to: z.array(z.string()),
    subject: z.string(),
    created_at: z.iso.datetime(),
    tags: z.record(z.string(), z.string()).optional(),
    bounce: z
      .object({ message: z.string(), type: z.literal('Permanent'), subType: z.string() })
      .optional(),
    click: z
      .object({
        link: z.string(),
        ipAddress: z.string(),
        userAgent: z.string(),
        timestamp: z.iso.datetime(),
      })
      .optional(),
    failed: z.object({ reason: z.string() }).optional(),
  }),
})

export const BrevoWebhookPayload = z.object({
  event: z.enum([
    'request',
    'delivered',
    'soft_bounce',
    'hard_bounce',
    'spam',
    'opened',
    'click',
    'deferred',
    'blocked',
  ]),
  email: z.string(), // the recipient
  id: z.number().int(), // webhook id = endpoint numericId
  date: z.string(), // "YYYY-MM-DD HH:mm:ss", workspace timezone
  ts: z.number().int(),
  ts_event: z.number().int(),
  ts_epoch: z.number().int(),
  'message-id': z.string(),
  subject: z.string(),
  tag: z.string().optional(),
  tags: z.array(z.string()).optional(),
  template_id: z.number().int().optional(),
  'X-Mailin-custom': z.string().optional(),
  link: z.string().optional(),
  reason: z.string().optional(),
  source: z.enum(['API', 'SMTP']).optional(),
})

export type UnifiedWebhookPayload = z.output<typeof UnifiedWebhookPayload>
export type ResendWebhookPayload = z.output<typeof ResendWebhookPayload>
export type BrevoWebhookPayload = z.output<typeof BrevoWebhookPayload>
