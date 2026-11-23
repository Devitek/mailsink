import { z } from 'zod'
import { Email, IsoDateTime, issue } from './common'
import { TemplateExternalId } from './templates'

// Brevo drop-in dialect, `POST /v3/smtp/email` (#29), mirrors `SendTransacEmailRequest` of
// the official SDK (`@getbrevo/brevo` 6.x). Unknown keys are dropped, as Brevo ignores them.

/** Brevo caps a message version at 99 recipients and a request at 2000. */
export const BREVO_MAX_VERSION_RECIPIENTS = 99
export const BREVO_MAX_TOTAL_RECIPIENTS = 2000

export const BrevoAddress = z.object({
  email: Email,
  name: z.string().max(70).optional(),
})
const Recipients = z.array(BrevoAddress).max(BREVO_MAX_VERSION_RECIPIENTS)
const Params = z.record(z.string(), z.unknown())

export const BrevoAttachment = z
  .object({
    content: z.base64().optional(),
    url: z.url().optional(), // stored as metadata, never fetched
    name: z.string().min(1).max(255).optional(),
  })
  .refine((a) => a.content !== undefined || a.url !== undefined, {
    message: 'An attachment needs content or url',
    params: { code: 'attachment_content_required' },
  })
  .refine((a) => a.content === undefined || a.name !== undefined, {
    message: 'name is required with content',
    params: { code: 'attachment_name_required' },
    path: ['name'],
  })

export const BrevoMessageVersion = z.object({
  to: Recipients.min(1),
  cc: Recipients.optional(),
  bcc: Recipients.optional(),
  replyTo: BrevoAddress.optional(),
  subject: z.string().max(998).optional(),
  htmlContent: z.string().optional(),
  textContent: z.string().optional(),
  params: Params.optional(),
})

const recipientCount = (r: { to?: unknown[]; cc?: unknown[]; bcc?: unknown[] }) =>
  (r.to?.length ?? 0) + (r.cc?.length ?? 0) + (r.bcc?.length ?? 0)

export const BrevoSendRequest = z
  .object({
    sender: BrevoAddress.optional(), // `sender.id` (dedicated IP senders) is not supported
    to: Recipients.optional(),
    cc: Recipients.optional(),
    bcc: Recipients.optional(),
    replyTo: BrevoAddress.optional(),
    subject: z.string().max(998).optional(),
    htmlContent: z.string().optional(),
    textContent: z.string().optional(),
    templateId: TemplateExternalId.optional(),
    params: Params.optional(),
    headers: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .transform((h) => Object.fromEntries(Object.entries(h).map(([k, v]) => [k, String(v)])))
      .optional(),
    attachment: z.array(BrevoAttachment).max(100).optional(),
    tags: z.array(z.string().min(1).max(256)).max(50).optional(),
    scheduledAt: IsoDateTime.optional(), // stored, not delayed
    batchId: z.uuid().optional(),
    messageVersions: z.array(BrevoMessageVersion).min(1).max(1000).optional(),
  })
  .refine(
    (b) => b.messageVersions !== undefined || (b.to?.length ?? 0) > 0,
    issue('to_required', 'to is required when messageVersions is absent', ['to']),
  )
  .refine(
    (b) => b.templateId !== undefined || Boolean(b.htmlContent || b.textContent),
    issue('content_required', 'htmlContent, textContent or templateId is required', [
      'htmlContent',
    ]),
  )
  .refine(
    (b) => b.templateId !== undefined || b.sender !== undefined,
    issue('sender_required', 'sender is required when templateId is absent', ['sender']),
  )
  .refine(
    (b) =>
      b.templateId !== undefined ||
      b.subject !== undefined ||
      (b.messageVersions?.every((v) => v.subject !== undefined) ?? false),
    issue('subject_required', 'subject is required when templateId is absent', ['subject']),
  )
  .refine(
    (b) =>
      (b.messageVersions
        ? b.messageVersions.reduce((sum, v) => sum + recipientCount(v), 0)
        : recipientCount(b)) <= BREVO_MAX_TOTAL_RECIPIENTS,
    issue('too_many_recipients', `At most ${BREVO_MAX_TOTAL_RECIPIENTS} recipients`, ['to']),
  )

/** 201: `messageId` for a single message, `messageIds` (one per version) otherwise. */
export const BrevoSendResponse = z.union([
  z.object({ messageId: z.string() }), // "<msg_…@mailsink>", the Message-ID header
  z.object({ messageIds: z.array(z.string()) }),
])

/** Brevo error codes Mailsink answers with (developers.brevo.com, « Error codes »). */
export const BrevoErrorCode = z.enum([
  'invalid_parameter',
  'missing_parameter',
  'out_of_range',
  'unauthorized',
  'permission_denied',
  'document_not_found',
  'duplicate_parameter',
  'duplicate_request',
  'too_many_requests', // not in Brevo's list, which only documents the 429 status
  'chaos_injected', // Mailsink chaos (D93), whatever the drawn status
  'internal_error',
])

export const BrevoError = z.object({ code: BrevoErrorCode, message: z.string() })

export type BrevoAddress = z.output<typeof BrevoAddress>
export type BrevoAttachment = z.output<typeof BrevoAttachment>
export type BrevoMessageVersion = z.output<typeof BrevoMessageVersion>
export type BrevoSendRequest = z.output<typeof BrevoSendRequest>
export type BrevoSendRequestInput = z.input<typeof BrevoSendRequest>
export type BrevoSendResponse = z.output<typeof BrevoSendResponse>
export type BrevoErrorCode = z.output<typeof BrevoErrorCode>
export type BrevoError = z.output<typeof BrevoError>
