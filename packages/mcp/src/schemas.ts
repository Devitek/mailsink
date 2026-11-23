// Tool input schemas, built from the Capture API contracts (03-contracts, « MCP »). They
// stay plain objects at the root (some clients refuse a root `oneOf`); the handlers parse
// the arguments again with the full contract when it holds refinements.
import {
  ActivateOverrideRequest,
  ListApiLogsQuery,
  ListMessagesQuery,
  ListSmtpSessionsQuery,
  ListWebhookDeliveriesQuery,
  MessageId,
  TriggerEventRequest,
  WAIT_TIMEOUT_MAX_MS,
  WebhookDeliveryId,
} from '@mailsink/contracts'
import { z } from 'zod'

const { wait: _wait, timeout: _timeout, ...messageFilters } = ListMessagesQuery.shape

/** `list_emails`: the `GET /capture/messages` filters, without the long-poll knobs. */
export const ListEmailsInput = z.object(messageFilters)

/** `wait_for_email` waits the longest the API allows by default (proposition D167). */
export const WAIT_FOR_EMAIL_DEFAULT_MS = WAIT_TIMEOUT_MAX_MS

/** `wait_for_email`: the same filters plus the timeout of `wait=true`. */
export const WaitForEmailInput = z.object({
  ...messageFilters,
  timeout: z
    .number()
    .int()
    .min(0)
    .max(WAIT_TIMEOUT_MAX_MS)
    .default(WAIT_FOR_EMAIL_DEFAULT_MS)
    .describe('Milliseconds to wait for a first match (max 30000)'),
})

export const GetEmailInput = z.object({ id: MessageId.describe('Message id (msg_…)') })

export const TriggerEmailEventInput = z.object({
  id: MessageId.describe('Message id (msg_…)'),
  event: TriggerEventRequest.describe(
    'opened, clicked (with url) or a forced status; one event per recipient unless recipient is set',
  ),
})

export const SetOverrideInput = ActivateOverrideRequest

export const GetDeliveryLogsInput = z.object({
  source: z
    .enum(['api', 'smtp'])
    .default('api')
    .describe('api: HTTP request log; smtp: SMTP sessions with their transcript'),
  id: z
    .string()
    .optional()
    .describe('One entry (req_… or smtp_…) with headers, bodies or transcript'),
  apiFilters: ListApiLogsQuery.optional().describe('Filters of the API request log'),
  smtpFilters: ListSmtpSessionsQuery.optional().describe('Filters of the SMTP sessions'),
})

export const GetWebhookDeliveriesInput = ListWebhookDeliveriesQuery.extend({
  id: WebhookDeliveryId.optional().describe('One delivery (whd_…) with body and attempts'),
})
