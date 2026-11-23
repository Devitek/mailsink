import { z } from 'zod'
import { Email, IsoDateTime, Page, PageLimit } from './common'
import { MessageId, prefixedId } from './ids'

export const SuppressionId = prefixedId('sup')

/** Mirrors the pg enum `suppression_reason`. */
export const SuppressionReason = z.enum(['hard_bounce', 'complained', 'manual'])

/** `GET /capture/suppressions`: newest first, keyset cursor (the id of the last row). */
export const ListSuppressionsQuery = z.object({
  email: z.string().optional(), // case-insensitive substring
  limit: PageLimit,
  cursor: SuppressionId.optional(),
})

/** `DELETE /capture/suppressions[?email=]`: one address, or the whole list when omitted. */
export const DeleteSuppressionsQuery = z.object({ email: Email.optional() })

export const SuppressionView = z.object({
  id: SuppressionId,
  email: z.string(),
  reason: SuppressionReason,
  messageId: MessageId.nullable(),
  createdAt: IsoDateTime,
})

export const ListSuppressionsResponse = Page(SuppressionView)
export const DeleteSuppressionsResponse = z.object({ count: z.number().int().min(0) })

export type SuppressionReason = z.output<typeof SuppressionReason>
export type ListSuppressionsQuery = z.output<typeof ListSuppressionsQuery>
export type DeleteSuppressionsQuery = z.output<typeof DeleteSuppressionsQuery>
export type SuppressionView = z.output<typeof SuppressionView>
export type ListSuppressionsResponse = z.output<typeof ListSuppressionsResponse>
export type DeleteSuppressionsResponse = z.output<typeof DeleteSuppressionsResponse>
