import { z } from 'zod'
import { Address, AddressList } from './address'
import { issue, Tag } from './common'
import { ApiError } from './errors'
import { MessageId } from './ids'
import { DeliveryStatus } from './status'

export const MAX_RECIPIENTS = 50
export const MAX_BATCH_SIZE = 100

export const AttachmentInput = z.object({
  filename: z.string().min(1).max(255),
  content: z.base64(),
  contentType: z.string().optional(), // sniffed from filename otherwise
  contentId: z.string().optional(), // inline cid
})

export const SendEmailRequest = z
  .object({
    from: Address,
    to: AddressList,
    cc: AddressList.optional(),
    bcc: AddressList.optional(),
    replyTo: AddressList.optional(),
    subject: z.string().max(998),
    html: z.string().optional(),
    text: z.string().optional(),
    headers: z.record(z.string(), z.string()).optional(),
    tags: z.array(Tag).max(50).optional(),
    attachments: z.array(AttachmentInput).max(100).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((e) => e.to.length > 0, issue('to_required', 'At least one "to" recipient', ['to']))
  .refine(
    (e) => Boolean(e.html || e.text),
    issue('html_or_text_required', 'Either html or text is required', ['html']),
  )
  .refine(
    (e) => e.to.length + (e.cc?.length ?? 0) + (e.bcc?.length ?? 0) <= MAX_RECIPIENTS,
    issue('too_many_recipients', `At most ${MAX_RECIPIENTS} recipients (to + cc + bcc)`, ['to']),
  )

export const SendEmailResponse = z.object({ id: MessageId, status: DeliveryStatus })

/**
 * Batch envelope: 1 to 100 items. Items are validated one by one with SendEmailRequest
 * (see parseBatchItem) so a bad item only fails its own slot (partial success, 207).
 */
export const BatchRequest = z.array(z.unknown()).min(1).max(MAX_BATCH_SIZE)

export const BatchItemResult = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), index: z.number().int(), id: MessageId }),
  z.object({ ok: z.literal(false), index: z.number().int(), error: ApiError }),
])

/** 207 when partial, 200 when every item is accepted. */
export const BatchResponse = z.object({ data: z.array(BatchItemResult) })

/** Validates one batch item; the error is ready for a BatchItemResult. */
export function parseBatchItem(
  item: unknown,
): { ok: true; data: SendEmailRequest } | { ok: false; error: ApiError } {
  const result = SendEmailRequest.safeParse(item)
  if (result.success) return { ok: true, data: result.data }
  return {
    ok: false,
    error: {
      code: 'validation_error',
      message: result.error.issues[0]?.message ?? 'Invalid email',
      details: result.error.issues,
    },
  }
}

export type AttachmentInput = z.output<typeof AttachmentInput>
export type SendEmailRequest = z.output<typeof SendEmailRequest>
export type SendEmailRequestInput = z.input<typeof SendEmailRequest>
export type SendEmailResponse = z.output<typeof SendEmailResponse>
export type BatchItemResult = z.output<typeof BatchItemResult>
export type BatchResponse = z.output<typeof BatchResponse>
