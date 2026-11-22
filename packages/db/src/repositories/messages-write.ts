import { and, eq, inArray } from 'drizzle-orm'
import type { Executor } from '../client'
import { attachments } from '../schema/attachments'
import { messageEvents } from '../schema/events'
import { messageRecipients, messages } from '../schema/messages'
import { suppressions } from '../schema/suppressions'

export type NewMessage = typeof messages.$inferInsert
export type NewMessageRecipient = typeof messageRecipients.$inferInsert
export type NewAttachment = typeof attachments.$inferInsert
export type NewMessageEvent = typeof messageEvents.$inferInsert

export interface MessageGraph {
  message: NewMessage
  recipients: NewMessageRecipient[]
  attachments: NewAttachment[]
  events: NewMessageEvent[]
}

/** Inserts a message with its recipients, attachments and events (call inside a tx). */
export async function insertMessageGraph(db: Executor, graph: MessageGraph): Promise<void> {
  await db.insert(messages).values(graph.message)
  if (graph.recipients.length > 0) await db.insert(messageRecipients).values(graph.recipients)
  if (graph.attachments.length > 0) await db.insert(attachments).values(graph.attachments)
  if (graph.events.length > 0) await db.insert(messageEvents).values(graph.events)
}

/**
 * Which of the given (lower-cased) addresses are on the workspace suppression list.
 * Read by ingestion (D10); the list itself is maintained by the suppression service (#23).
 */
export async function findSuppressedEmails(
  db: Executor,
  workspaceId: string,
  emails: readonly string[],
): Promise<Set<string>> {
  if (emails.length === 0) return new Set()
  const rows = await db
    .select({ email: suppressions.email })
    .from(suppressions)
    .where(and(eq(suppressions.workspaceId, workspaceId), inArray(suppressions.email, [...emails])))
  return new Set(rows.map((r) => r.email))
}
