import { z } from 'zod'
import { Email, issue } from './common'
import { TemplateExternalId } from './templates'

// Brevo read routes of a `brevo` connection (#149, propositions D275, D276), checked against
// developers.brevo.com on 24/11/2026: `GET /v3/smtp/emails`, `GET /v3/smtp/blockedContacts`
// and `DELETE /v3/smtp/blockedContacts/{email}`. Dates are calendar days (YYYY-MM-DD, UTC).

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** A YYYY-MM-DD calendar day that exists (2026-02-30 does not). */
const BrevoDay = z
  .string()
  .regex(DAY_RE, 'Use the YYYY-MM-DD format')
  .refine((d) => new Date(`${d}T00:00:00Z`).toISOString().startsWith(d), 'Invalid date')

/** Last day of the one month window starting at `start` (2026-01-31 -> 2026-02-28). */
export function brevoMonthEnd(start: string): string {
  const [y, m, d] = start.split('-').map(Number) as [number, number, number]
  const lastOfNext = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  return new Date(Date.UTC(y, m, Math.min(d, lastOfNext))).toISOString().slice(0, 10)
}

const Sort = z.enum(['asc', 'desc']).default('desc')
const Offset = z.coerce.number().int().min(0).default(0)
type DateRange = { startDate?: string; endDate?: string }

const bothDatesOrNone = (q: DateRange) => (q.startDate === undefined) === (q.endDate === undefined)
const datesInOrder = (q: DateRange) => !q.startDate || !q.endDate || q.startDate <= q.endDate
const dateIssue = issue('date_range_required', 'startDate and endDate go together', ['startDate'])
const orderIssue = issue('date_range_order', 'endDate must not be before startDate', ['endDate'])

export const BrevoListEmailsQuery = z
  .object({
    email: Email.optional(),
    templateId: TemplateExternalId.optional(),
    messageId: z.string().trim().min(1).optional(),
    startDate: BrevoDay.optional(),
    endDate: BrevoDay.optional(),
    sort: Sort,
    limit: z.coerce.number().int().min(0).max(500).default(500),
    offset: Offset,
  })
  .refine(
    (q) => q.email !== undefined || q.templateId !== undefined || q.messageId !== undefined,
    issue('filter_required', 'email, templateId or messageId is required', ['email']),
  )
  .refine(bothDatesOrNone, dateIssue)
  .refine(datesInOrder, orderIssue)
  .refine(
    (q) => !q.startDate || !q.endDate || q.endDate <= brevoMonthEnd(q.startDate),
    issue('date_range_too_long', 'The date range is at most one month', ['endDate']),
  )

export const BrevoTransactionalEmail = z.object({
  email: z.string(), // the recipient of this copy
  subject: z.string(),
  templateId: z.number().int().optional(),
  messageId: z.string(), // "<msg_…@mailsink>", as answered by POST /v3/smtp/email
  uuid: z.string(), // one per message and recipient
  date: z.string(), // ISO 8601, UTC, seconds
  from: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export const BrevoListEmailsResponse = z.object({
  count: z.number().int(), // every copy matching the filters, all pages
  transactionalEmails: z.array(BrevoTransactionalEmail),
})

/** `senders`: comma separated, also repeated (`senders=a&senders=b`, the SDK sends both). */
const Senders = z.union([z.string(), z.array(z.string())]).transform((v) => [
  ...new Set(
    [v]
      .flat()
      .flatMap((s) => s.split(','))
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  ),
])

const notInFuture = (d: string | undefined) => !d || d <= new Date().toISOString().slice(0, 10)

export const BrevoBlockedContactsQuery = z
  .object({
    startDate: BrevoDay.optional(),
    endDate: BrevoDay.optional(),
    limit: z.coerce.number().int().min(0).max(100).default(50),
    offset: Offset,
    senders: Senders.optional(),
    sort: Sort,
  })
  .refine(bothDatesOrNone, dateIssue)
  .refine(datesInOrder, orderIssue)
  .refine(
    (q) => notInFuture(q.startDate) && notInFuture(q.endDate),
    issue('date_in_future', 'Dates cannot be in the future', ['endDate']),
  )

/** Reason codes of Brevo; Mailsink lists `hardBounce`, `contactFlaggedAsSpam`, `adminBlocked`. */
export const BrevoBlockReasonCode = z.enum([
  'unsubscribedViaMA',
  'unsubscribedViaEmail',
  'adminBlocked',
  'unsubscribedViaApi',
  'hardBounce',
  'contactFlaggedAsSpam',
])

export const BrevoBlockedContact = z.object({
  email: z.string(),
  senderEmail: z.string().nullable(), // sender of the message that listed it, if still kept
  reason: z.object({ code: BrevoBlockReasonCode, message: z.string() }),
  blockedAt: z.string(), // ISO 8601, UTC, seconds
})

export const BrevoBlockedContactsResponse = z.object({
  contacts: z.array(BrevoBlockedContact),
  count: z.number().int(),
})

export const BrevoBlockedContactParams = z.object({ email: Email })

export type BrevoListEmailsQuery = z.output<typeof BrevoListEmailsQuery>
export type BrevoTransactionalEmail = z.output<typeof BrevoTransactionalEmail>
export type BrevoListEmailsResponse = z.output<typeof BrevoListEmailsResponse>
export type BrevoBlockedContactsQuery = z.output<typeof BrevoBlockedContactsQuery>
export type BrevoBlockReasonCode = z.output<typeof BrevoBlockReasonCode>
export type BrevoBlockedContact = z.output<typeof BrevoBlockedContact>
export type BrevoBlockedContactsResponse = z.output<typeof BrevoBlockedContactsResponse>
