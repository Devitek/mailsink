import { and, count, eq, inArray, sql } from 'drizzle-orm'
import type { Executor } from '../client'
import { apiLogs, smtpSessions } from '../schema/logs'
import { messages } from '../schema/messages'
import { webhookDeliveries } from '../schema/webhook-deliveries'
import type { DeliveryStatusValue } from './messages-read'

// Reads of the web UI inbox (#39) that the Capture API does not need: facet counts and the
// body excerpts of the list rows.

/** Characters of the body read for a list preview: enough for one line after cleanup. */
export const PREVIEW_SOURCE_CHARS = 2_000

export interface MessageFacetCounts {
  byStatus: { status: DeliveryStatusValue; count: number }[]
  /** `connectionId` null: messages whose connection was deleted. */
  byConnection: { connectionId: string | null; count: number }[]
}

/** Messages of the workspace per status and per connection (whole inbox, no filter). */
export async function countMessageFacets(
  db: Executor,
  workspaceId: string,
): Promise<MessageFacetCounts> {
  const scope = eq(messages.workspaceId, workspaceId)
  const [byStatus, byConnection] = await Promise.all([
    db
      .select({ status: messages.status, count: count() })
      .from(messages)
      .where(scope)
      .groupBy(messages.status),
    db
      .select({ connectionId: messages.connectionId, count: count() })
      .from(messages)
      .where(scope)
      .groupBy(messages.connectionId),
  ])
  return { byStatus, byConnection }
}

/** Rows of the logs explorer: API calls, SMTP sessions and webhook deliveries. */
export async function countWorkspaceLogs(db: Executor, workspaceId: string): Promise<number> {
  const [api, smtp, deliveries] = await Promise.all([
    db.select({ n: count() }).from(apiLogs).where(eq(apiLogs.workspaceId, workspaceId)),
    db.select({ n: count() }).from(smtpSessions).where(eq(smtpSessions.workspaceId, workspaceId)),
    db
      .select({ n: count() })
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.workspaceId, workspaceId)),
  ])
  return (api[0]?.n ?? 0) + (smtp[0]?.n ?? 0) + (deliveries[0]?.n ?? 0)
}

export interface MessageExcerpt {
  id: string
  /** The beginning of the text body, else of the HTML body (markup included), or null. */
  text: string | null
  html: boolean
}

/** The start of each message body, for the list previews (another workspace's ids: none). */
export async function listMessageExcerpts(
  db: Executor,
  workspaceId: string,
  messageIds: string[],
): Promise<MessageExcerpt[]> {
  if (messageIds.length === 0) return []
  const hasText = sql`coalesce(${messages.text}, '') <> ''`
  return db
    .select({
      id: messages.id,
      text: sql<string | null>`case when ${hasText}
        then left(${messages.text}, ${PREVIEW_SOURCE_CHARS})
        else left(${messages.html}, ${PREVIEW_SOURCE_CHARS}) end`,
      html: sql<boolean>`not (${hasText})`,
    })
    .from(messages)
    .where(and(eq(messages.workspaceId, workspaceId), inArray(messages.id, messageIds)))
}
