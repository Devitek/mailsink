import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import type { Executor } from '../client'
import { attachments } from '../schema/attachments'
import { messageEvents } from '../schema/events'
import { messages } from '../schema/messages'
import type { MessageEventRow, MessageRow } from './messages-read'

/** An event row with the connection of its message (stream `connectionId` filter). */
export type StreamEventRow = MessageEventRow & { connectionId: string | null }

const streamColumns = { event: messageEvents, connectionId: messages.connectionId }
const flatten = (rows: { event: MessageEventRow; connectionId: string | null }[]) =>
  rows.map((r) => ({ ...r.event, connectionId: r.connectionId }))

/**
 * `Last-Event-ID` replay: the events of the workspace strictly after `afterId`, in
 * `(occurred_at, id)` order (`events_ws_time_idx`), at most `limit`. An id unknown to the
 * workspace (purged, another workspace's) replays nothing.
 */
export async function listWorkspaceEventsAfter(
  db: Executor,
  workspaceId: string,
  afterId: string,
  limit: number,
): Promise<StreamEventRow[]> {
  const anchor = db
    .select({ at: messageEvents.occurredAt, id: messageEvents.id })
    .from(messageEvents)
    .where(and(eq(messageEvents.workspaceId, workspaceId), eq(messageEvents.id, afterId)))
    .as('anchor')
  const rows = await db
    .select(streamColumns)
    .from(messageEvents)
    .innerJoin(
      anchor,
      sql`(${messageEvents.occurredAt}, ${messageEvents.id}) > (${anchor.at}, ${anchor.id})`,
    )
    .innerJoin(messages, eq(messages.id, messageEvents.messageId))
    .where(eq(messageEvents.workspaceId, workspaceId))
    .orderBy(asc(messageEvents.occurredAt), asc(messageEvents.id))
    .limit(limit)
  return flatten(rows)
}

/** Every event of one message with its connection, oldest first. */
export async function listMessageStreamEvents(
  db: Executor,
  messageId: string,
): Promise<StreamEventRow[]> {
  const rows = await db
    .select(streamColumns)
    .from(messageEvents)
    .innerJoin(messages, eq(messages.id, messageEvents.messageId))
    .where(eq(messageEvents.messageId, messageId))
    .orderBy(asc(messageEvents.occurredAt), asc(messageEvents.id))
  return flatten(rows)
}

/** Messages of the workspace by id, with `hasAttachments` (replayed `message.created`). */
export async function findWorkspaceMessagesByIds(
  db: Executor,
  workspaceId: string,
  ids: string[],
): Promise<(MessageRow & { hasAttachments: boolean })[]> {
  if (ids.length === 0) return []
  const hasAttachments = sql<boolean>`exists (select 1 from ${attachments}
    where ${attachments.messageId} = ${sql.raw('"messages"."id"')}
    and ${attachments.disposition} = 'attachment')`
  const rows = await db
    .select({ message: messages, hasAttachments })
    .from(messages)
    .where(and(eq(messages.workspaceId, workspaceId), inArray(messages.id, ids)))
  return rows.map((r) => ({ ...r.message, hasAttachments: r.hasAttachments }))
}
