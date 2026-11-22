import { and, asc, desc, eq, gte, inArray, lte, type SQL, sql } from 'drizzle-orm'
import type { Executor } from '../client'
import { attachments } from '../schema/attachments'
import { blobs } from '../schema/blobs'
import { messageEvents } from '../schema/events'
import { messageRecipients, messages } from '../schema/messages'
import { searchDocument } from '../search-document'

export type MessageRow = typeof messages.$inferSelect
export type RecipientRow = typeof messageRecipients.$inferSelect
export type AttachmentRow = typeof attachments.$inferSelect
export type MessageEventRow = typeof messageEvents.$inferSelect
export type DeliveryStatusValue = MessageRow['status']

/** Capture search filters, always scoped to one workspace. */
export interface MessageSearch {
  workspaceId: string
  /** Case-insensitive substrings. */
  to?: string
  from?: string
  subject?: string
  tag?: { name: string; value?: string }
  statuses?: DeliveryStatusValue[]
  connectionId?: string
  since?: Date
  until?: Date
  /**
   * Full text on subject, text and HTML bodies (`simple` config, websearch syntax), within
   * their first `SEARCH_DOCUMENT_MAX_CHARS` characters.
   */
  q?: string
  /** Keyset position: rows strictly older than this (created_at, id) pair. */
  after?: { createdAt: string; id: string }
  limit: number
}

export type MessageListRow = MessageRow & {
  hasAttachments: boolean
  /** created_at with microseconds, UTC (`2026-11-22T10:00:00.123456Z`), for cursors. */
  cursorAt: string
}

// Correlated subqueries: Drizzle renders single-table columns unqualified, so the outer
// message id is spelled out to avoid resolving it against the subquery's own `id`.
const outerMessageId = sql.raw('"messages"."id"')

const like = (value: string) => `%${value.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

/** At least one real attachment (inline parts such as cid: images do not count). */
const hasAttachments = sql<boolean>`exists (select 1 from ${attachments}
  where ${attachments.messageId} = ${outerMessageId} and ${attachments.disposition} = 'attachment')`

const cursorAt = sql<string>`to_char(${messages.createdAt} at time zone 'UTC',
  'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`

const searchable = searchDocument(messages)

function conditions(s: MessageSearch): SQL[] {
  const where: SQL[] = [eq(messages.workspaceId, s.workspaceId)]
  if (s.to) {
    const p = like(s.to)
    where.push(sql`exists (select 1 from ${messageRecipients}
      where ${messageRecipients.messageId} = ${outerMessageId}
      and (${messageRecipients.email} ilike ${p} or ${messageRecipients.name} ilike ${p}))`)
  }
  if (s.from) {
    const p = like(s.from)
    where.push(sql`(${messages.from}->>'email' ilike ${p} or ${messages.from}->>'name' ilike ${p})`)
  }
  if (s.subject) where.push(sql`${messages.subject} ilike ${like(s.subject)}`)
  if (s.tag) where.push(sql`${messages.tags} @> ${JSON.stringify([s.tag])}::jsonb`)
  if (s.statuses?.length) where.push(inArray(messages.status, s.statuses))
  if (s.connectionId) where.push(eq(messages.connectionId, s.connectionId))
  if (s.since) where.push(gte(messages.createdAt, s.since))
  if (s.until) where.push(lte(messages.createdAt, s.until))
  if (s.q?.trim()) where.push(sql`${searchable} @@ websearch_to_tsquery('simple', ${s.q})`)
  if (s.after) {
    where.push(
      sql`(${messages.createdAt}, ${messages.id}) < (${s.after.createdAt}::timestamptz, ${s.after.id})`,
    )
  }
  return where
}

/** The page query of `searchMessages`, unexecuted (index usage tests explain it). */
export function searchMessagesQuery(db: Executor, s: MessageSearch) {
  return db
    .select({ message: messages, hasAttachments, cursorAt })
    .from(messages)
    .where(and(...conditions(s)))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(s.limit + 1)
}

/** One page of messages, newest first, plus one extra row when a next page exists. */
export async function searchMessages(db: Executor, s: MessageSearch): Promise<MessageListRow[]> {
  const rows = await searchMessagesQuery(db, s)
  return rows.map((r) => ({ ...r.message, hasAttachments: r.hasAttachments, cursorAt: r.cursorAt }))
}

/** Recipients of the given messages, by kind then insertion order. */
export async function listRecipients(db: Executor, messageIds: string[]): Promise<RecipientRow[]> {
  if (messageIds.length === 0) return []
  return db
    .select()
    .from(messageRecipients)
    .where(inArray(messageRecipients.messageId, messageIds))
    .orderBy(asc(messageRecipients.kind), asc(messageRecipients.id))
}

/** A message of the workspace, or undefined (another workspace's id is never visible). */
export async function findWorkspaceMessage(
  db: Executor,
  workspaceId: string,
  messageId: string,
): Promise<(MessageRow & { hasAttachments: boolean }) | undefined> {
  const [row] = await db
    .select({ message: messages, hasAttachments })
    .from(messages)
    .where(and(eq(messages.workspaceId, workspaceId), eq(messages.id, messageId)))
    .limit(1)
  return row && { ...row.message, hasAttachments: row.hasAttachments }
}

export async function listAttachments(db: Executor, messageId: string): Promise<AttachmentRow[]> {
  return db
    .select()
    .from(attachments)
    .where(eq(attachments.messageId, messageId))
    .orderBy(asc(attachments.id))
}

export async function listMessageEvents(
  db: Executor,
  messageId: string,
): Promise<MessageEventRow[]> {
  return db
    .select()
    .from(messageEvents)
    .where(eq(messageEvents.messageId, messageId))
    .orderBy(asc(messageEvents.occurredAt), asc(messageEvents.id))
}

/** Raw EML bytes of a workspace message; undefined when the message or its source is missing. */
export async function findRawMessage(
  db: Executor,
  workspaceId: string,
  messageId: string,
): Promise<Uint8Array | undefined> {
  const [row] = await db
    .select({ data: blobs.data })
    .from(messages)
    .innerJoin(blobs, and(eq(blobs.id, messages.rawBlobId), eq(blobs.workspaceId, workspaceId)))
    .where(and(eq(messages.workspaceId, workspaceId), eq(messages.id, messageId)))
    .limit(1)
  return row?.data
}

/** An attachment of a workspace message with its bytes, or undefined. */
export async function findAttachmentContent(
  db: Executor,
  workspaceId: string,
  messageId: string,
  attachmentId: string,
): Promise<(AttachmentRow & { data: Uint8Array }) | undefined> {
  const [row] = await db
    .select({ attachment: attachments, data: blobs.data })
    .from(attachments)
    .innerJoin(messages, eq(messages.id, attachments.messageId))
    .innerJoin(blobs, and(eq(blobs.id, attachments.blobId), eq(blobs.workspaceId, workspaceId)))
    .where(
      and(
        eq(messages.workspaceId, workspaceId),
        eq(messages.id, messageId),
        eq(attachments.id, attachmentId),
      ),
    )
    .limit(1)
  return row && { ...row.attachment, data: row.data }
}
