import { z } from 'zod'
import { parseAddress } from './address'
import { issue } from './common'
import { MAX_BATCH_SIZE, MAX_RECIPIENTS } from './native'

// Resend drop-in dialect (03-contracts, « Resend dialect »): the public Resend API as the
// official `resend` SDK sends it (snake_case, addresses as strings).

export const RESEND_ADDRESS_HINT =
  'The email address needs to follow the `email@example.com` or `Name <email@example.com>` format.'

/** "jane@x.io" or "Jane <jane@x.io>" (strings only, as Resend) to { email, name? }. */
export const ResendAddress = z.string().transform((value, ctx) => {
  const parsed = parseAddress(value)
  if (!parsed) {
    ctx.issues.push({
      code: 'custom',
      input: value,
      message: RESEND_ADDRESS_HINT,
      params: { code: 'invalid_address' },
    })
    return z.NEVER
  }
  return parsed
})

/** One address or an array of addresses, always output as an array. */
export const ResendAddressList = z
  .union([ResendAddress, z.array(ResendAddress)])
  .transform((v) => (Array.isArray(v) ? v : [v]))

const TAG_PART = z
  .string()
  .min(1)
  .max(256)
  .regex(
    /^[A-Za-z0-9_-]+$/,
    'Tags can only contain ASCII letters, numbers, underscores or dashes (at most 256 characters).',
  )

export const ResendTag = z.object({ name: TAG_PART, value: TAG_PART })

export const ResendAttachment = z
  .object({
    content: z.base64().optional(), // the SDK turns a Buffer into base64
    path: z.string().optional(), // remote file: never fetched by Mailsink
    filename: z.string().optional(),
    content_type: z.string().optional(),
    content_id: z.string().optional(),
  })
  .refine(
    (a) => a.content !== undefined || a.path !== undefined,
    issue('attachment_content_required', 'Attachment must have either a `content` or `path`.'),
  )
  .refine(
    (a) => a.content !== undefined,
    issue(
      'attachment_path_unsupported',
      'Mailsink does not fetch attachment `path` URLs: send the file as `content`.',
    ),
  )

export const ResendSendRequest = z
  .object({
    from: ResendAddress,
    to: ResendAddressList,
    subject: z.string(),
    cc: ResendAddressList.optional(),
    bcc: ResendAddressList.optional(),
    reply_to: ResendAddressList.optional(),
    replyTo: ResendAddressList.optional(), // pre-1.0 SDKs sent camelCase
    html: z.string().optional(),
    text: z.string().optional(),
    headers: z.record(z.string(), z.string()).optional(),
    attachments: z.array(ResendAttachment).optional(),
    tags: z.array(ResendTag).optional(),
    scheduled_at: z.string().optional(), // accepted, not honoured (delivery is not delayed)
    topic_id: z.string().nullable().optional(), // accepted, ignored
    template: z.unknown().optional(), // hosted Resend templates: refused below
  })
  .refine(
    (e) => e.template === undefined,
    issue(
      'template_unsupported',
      'Resend hosted templates are not supported by Mailsink: send `html` or `text`.',
      ['template'],
    ),
  )
  .refine((e) => e.to.length > 0, issue('to_required', 'Missing `to` field.', ['to']))
  .refine(
    (e) => e.to.length <= MAX_RECIPIENTS,
    issue('too_many_recipients', `The \`to\` field can have at most ${MAX_RECIPIENTS} addresses.`, [
      'to',
    ]),
  )
  .refine(
    (e) => e.html !== undefined || e.text !== undefined,
    issue('html_or_text_required', 'Missing `html` or `text` field.', ['html']),
  )
export type ResendSendRequest = z.output<typeof ResendSendRequest>

/** `x-batch-validation` header of `POST /emails/batch` (SDK option `batchValidation`). */
export const ResendBatchValidation = z.enum(['strict', 'permissive'])
export type ResendBatchValidation = z.output<typeof ResendBatchValidation>
export const RESEND_MAX_BATCH_SIZE = MAX_BATCH_SIZE

export const ResendSendResponse = z.object({ id: z.uuid() })
export const ResendBatchResponse = z.object({
  data: z.array(z.object({ id: z.uuid() })),
  /** Permissive mode only: the refused items, the others are in `data`. */
  errors: z.array(z.object({ index: z.number().int(), message: z.string() })).optional(),
})
export type ResendSendResponse = z.output<typeof ResendSendResponse>
export type ResendBatchResponse = z.output<typeof ResendBatchResponse>

export const ResendLastEvent = z.enum([
  'bounced',
  'canceled',
  'clicked',
  'complained',
  'delivered',
  'delivery_delayed',
  'failed',
  'opened',
  'queued',
  'scheduled',
  'sent',
  'suppressed',
])

/** `GET /emails/:id` */
export const ResendEmail = z.object({
  object: z.literal('email'),
  id: z.uuid(),
  message_id: z.string(),
  to: z.array(z.string()),
  from: z.string(),
  created_at: z.string(), // "2026-04-03 22:13:42.674+00", as Resend
  subject: z.string(),
  html: z.string().nullable(),
  text: z.string().nullable(),
  bcc: z.array(z.string()),
  cc: z.array(z.string()),
  reply_to: z.array(z.string()),
  last_event: ResendLastEvent,
  scheduled_at: z.string().nullable(),
  tags: z.array(z.object({ name: z.string(), value: z.string() })),
})
export type ResendEmail = z.output<typeof ResendEmail>
export type ResendLastEvent = z.output<typeof ResendLastEvent>

/** Names Mailsink answers with (a subset of the SDK's `RESEND_ERROR_CODE_KEY`). */
export const ResendErrorName = z.enum([
  'missing_api_key',
  'validation_error',
  'missing_required_field',
  'invalid_attachment',
  'invalid_parameter',
  'invalid_idempotency_key',
  'invalid_idempotent_request',
  'concurrent_idempotent_requests',
  'restricted_api_key',
  'not_found',
  'rate_limit_exceeded',
  'application_error',
  'service_unavailable',
])
export type ResendErrorName = z.output<typeof ResendErrorName>

/** Every Resend error body: `{ statusCode, name, message }`. */
export const ResendErrorBody = z.object({
  statusCode: z.number().int(),
  name: ResendErrorName,
  message: z.string(),
})
export type ResendErrorBody = z.output<typeof ResendErrorBody>
