import { and, asc, count, desc, eq, gte, inArray, lt, type SQL, sql } from 'drizzle-orm'
import type { Executor } from '../client'
import { messageRecipients, messages } from '../schema/messages'
import { suppressions } from '../schema/suppressions'

// Offset pages of the Brevo read routes (#149): the copies sent by one connection
// (`GET /v3/smtp/emails`) and the workspace suppression list (`GET /v3/smtp/blockedContacts`).

export interface OffsetPage {
  /** Inclusive lower and exclusive upper bound on created_at. */
  since: Date
  until: Date
  sort: 'asc' | 'desc'
  limit: number
  offset: number
}

export interface ConnectionCopyFilter extends OffsetPage {
  workspaceId: string
  connectionId: string
  email?: string
  templateId?: number
  providerMessageId?: string
}

export interface ConnectionCopyRow {
  recipientId: string
  email: string
  messageId: string
  providerMessageId: string
  subject: string
  from: { email: string; name?: string | null }
  tags: { name: string; value: string }[]
  templateId: number | null
  createdAt: Date
}

function copyFilters(f: ConnectionCopyFilter): SQL[] {
  const where: SQL[] = [
    eq(messages.workspaceId, f.workspaceId),
    eq(messages.connectionId, f.connectionId),
    gte(messages.createdAt, f.since),
    lt(messages.createdAt, f.until),
  ]
  if (f.email !== undefined) where.push(eq(messageRecipients.email, f.email))
  if (f.providerMessageId !== undefined) {
    where.push(eq(messages.providerMessageId, f.providerMessageId))
  }
  if (f.templateId !== undefined) {
    where.push(sql`(${messages.templateRef} ->> 'templateId')::bigint = ${f.templateId}`)
  }
  return where
}

/** One row per message and recipient (to, cc, bcc) of the connection, with the total. */
export async function listConnectionCopies(
  db: Executor,
  filter: ConnectionCopyFilter,
): Promise<{ rows: ConnectionCopyRow[]; total: number }> {
  const where = and(...copyFilters(filter))
  const order = filter.sort === 'asc' ? asc : desc
  const [rows, [totals]] = await Promise.all([
    db
      .select({
        recipientId: messageRecipients.id,
        email: messageRecipients.email,
        messageId: messages.id,
        providerMessageId: messages.providerMessageId,
        subject: messages.subject,
        from: messages.from,
        tags: messages.tags,
        templateRef: messages.templateRef,
        createdAt: messages.createdAt,
      })
      .from(messageRecipients)
      .innerJoin(messages, eq(messages.id, messageRecipients.messageId))
      .where(where)
      .orderBy(order(messages.createdAt), order(messageRecipients.id))
      .limit(filter.limit)
      .offset(filter.offset),
    db
      .select({ n: count() })
      .from(messageRecipients)
      .innerJoin(messages, eq(messages.id, messageRecipients.messageId))
      .where(where),
  ])
  return {
    rows: rows.map(({ templateRef, ...row }) => ({
      ...row,
      templateId: templateRef?.templateId ?? null,
    })),
    total: totals?.n ?? 0,
  }
}

export interface SuppressionPageFilter extends Partial<Pick<OffsetPage, 'since' | 'until'>> {
  workspaceId: string
  /** Lower-cased sender addresses: only rows listed by a message of one of them. */
  senders?: string[]
  sort: 'asc' | 'desc'
  limit: number
  offset: number
}

export interface SuppressionPageRow {
  email: string
  reason: 'hard_bounce' | 'complained' | 'manual'
  senderEmail: string | null
  createdAt: Date
}

/** The suppression list by offset, with the sender of the message behind each address. */
export async function listSuppressionPage(
  db: Executor,
  filter: SuppressionPageFilter,
): Promise<{ rows: SuppressionPageRow[]; total: number }> {
  const senderEmail = sql<string | null>`lower(${messages.from} ->> 'email')`
  const where: SQL[] = [eq(suppressions.workspaceId, filter.workspaceId)]
  if (filter.since) where.push(gte(suppressions.createdAt, filter.since))
  if (filter.until) where.push(lt(suppressions.createdAt, filter.until))
  if (filter.senders?.length) where.push(inArray(senderEmail, filter.senders))
  const order = filter.sort === 'asc' ? asc : desc
  const [rows, [totals]] = await Promise.all([
    db
      .select({
        email: suppressions.email,
        reason: suppressions.reason,
        senderEmail,
        createdAt: suppressions.createdAt,
      })
      .from(suppressions)
      .leftJoin(messages, eq(messages.id, suppressions.messageId))
      .where(and(...where))
      .orderBy(order(suppressions.id))
      .limit(filter.limit)
      .offset(filter.offset),
    db
      .select({ n: count() })
      .from(suppressions)
      .leftJoin(messages, eq(messages.id, suppressions.messageId))
      .where(and(...where)),
  ])
  return { rows, total: totals?.n ?? 0 }
}
