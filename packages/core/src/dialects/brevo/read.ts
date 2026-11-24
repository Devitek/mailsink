import type {
  BrevoBlockedContact,
  BrevoBlockedContactsQuery,
  BrevoBlockedContactsResponse,
  BrevoListEmailsQuery,
  BrevoListEmailsResponse,
  BrevoTransactionalEmail,
} from '@mailsink/contracts'
import {
  type ConnectionCopyRow,
  deleteSuppressions,
  type Executor,
  listConnectionCopies,
  listSuppressionPage,
  type SuppressionPageRow,
} from '@mailsink/db'
import { DomainError } from '../../errors'
import { zonedDayRange, zonedToday } from './days'

// Brevo read routes of a `brevo` connection (#149, D275, D276). Calendar days are those of
// the workspace timezone (D23, D284).

const DAY_MS = 86_400_000
/** Window of `GET /v3/smtp/emails` without dates: the past 30 days, as Brevo. */
const DEFAULT_WINDOW_DAYS = 30

/** ISO 8601 to the second, as Brevo's examples (`2019-05-25T11:53:26Z`). */
export const brevoTimestamp = (date: Date): string => date.toISOString().replace(/\.\d{3}Z$/, 'Z')

/** Where a read runs: its workspace (and timezone) and the clock. */
export interface BrevoReadOptions {
  timeZone?: string
  now?: Date
}

/** Brevo message ids carry angle brackets; a bare id is accepted too. */
const bracketed = (id: string) => (id.startsWith('<') ? id : `<${id}>`)

function toTransactionalEmail(row: ConnectionCopyRow): BrevoTransactionalEmail {
  const tags = row.tags.map((t) => t.value || t.name)
  return {
    email: row.email,
    subject: row.subject,
    ...(row.templateId !== null ? { templateId: row.templateId } : {}),
    messageId: row.providerMessageId,
    uuid: row.recipientId.replace(/^rcp_/, ''),
    date: brevoTimestamp(row.createdAt),
    from: row.from.email,
    ...(tags.length > 0 ? { tags } : {}),
  }
}

/**
 * `GET /v3/smtp/emails`: one item per message and recipient sent through the connection,
 * filtered by recipient, template or message id, in a day range (the past 30 days by
 * default), newest first unless `sort=asc`, by offset.
 */
export async function listBrevoEmails(
  db: Executor,
  scope: { workspaceId: string; connectionId: string },
  query: BrevoListEmailsQuery,
  { timeZone = 'UTC', now = new Date() }: BrevoReadOptions = {},
): Promise<BrevoListEmailsResponse> {
  const range =
    query.startDate && query.endDate
      ? zonedDayRange(query.startDate, query.endDate, timeZone)
      : { since: new Date(now.getTime() - DEFAULT_WINDOW_DAYS * DAY_MS), until: now }
  const { rows, total } = await listConnectionCopies(db, {
    ...scope,
    ...range,
    email: query.email,
    templateId: query.templateId,
    providerMessageId: query.messageId === undefined ? undefined : bracketed(query.messageId),
    sort: query.sort,
    limit: query.limit,
    offset: query.offset,
  })
  return { count: total, transactionalEmails: rows.map(toTransactionalEmail) }
}

const REASONS: Record<SuppressionPageRow['reason'], BrevoBlockedContact['reason']> = {
  hard_bounce: { code: 'hardBounce', message: 'Hard bounce' },
  complained: { code: 'contactFlaggedAsSpam', message: 'Contact flagged as spam' },
  manual: { code: 'adminBlocked', message: 'Admin blocked' },
}

/**
 * `GET /v3/smtp/blockedContacts`: the workspace suppression list (D75), by offset, with the
 * sender of the message that listed each address (`senders` filters on it).
 */
export async function listBrevoBlockedContacts(
  db: Executor,
  workspaceId: string,
  query: BrevoBlockedContactsQuery,
  { timeZone = 'UTC', now = new Date() }: BrevoReadOptions = {},
): Promise<BrevoBlockedContactsResponse> {
  const today = zonedToday(now, timeZone)
  if ((query.startDate ?? '') > today || (query.endDate ?? '') > today) {
    throw new DomainError('validation_error', 'Dates cannot be in the future')
  }
  const range =
    query.startDate && query.endDate ? zonedDayRange(query.startDate, query.endDate, timeZone) : {}
  const { rows, total } = await listSuppressionPage(db, {
    workspaceId,
    ...range,
    senders: query.senders,
    sort: query.sort,
    limit: query.limit,
    offset: query.offset,
  })
  return {
    count: total,
    contacts: rows.map((row) => ({
      email: row.email,
      senderEmail: row.senderEmail,
      reason: REASONS[row.reason],
      blockedAt: brevoTimestamp(row.createdAt),
    })),
  }
}

/** `DELETE /v3/smtp/blockedContacts/{email}`: an address not on the list is a 404. */
export async function unblockBrevoContact(
  db: Executor,
  workspaceId: string,
  email: string,
): Promise<void> {
  if ((await deleteSuppressions(db, workspaceId, email)) === 0) {
    throw new DomainError('not_found', `Contact ${email} is not blocked`)
  }
}
