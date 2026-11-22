import { and, eq, inArray, lt, type SQL } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import type { Database } from '../client'
import { apiLogs, smtpSessions } from '../schema/logs'
import { messages } from '../schema/messages'
import { webhookDeliveries } from '../schema/webhook-deliveries'

export interface MessagePurge {
  workspaceId: string
  /** Only this connection's messages (and logs). */
  connectionId?: string
  /** Only rows created strictly before this instant. */
  before?: Date
  /** Also delete API logs, SMTP sessions and the purged messages' webhook deliveries. */
  includeLogs: boolean
}

type ScopeColumns = { workspace: PgColumn; connection: PgColumn; time: PgColumn }

function scope(p: MessagePurge, cols: ScopeColumns): SQL | undefined {
  const where: SQL[] = [eq(cols.workspace, p.workspaceId)]
  if (p.connectionId) where.push(eq(cols.connection, p.connectionId))
  if (p.before) where.push(lt(cols.time, p.before))
  return and(...where)
}

const messageScope = {
  workspace: messages.workspaceId,
  connection: messages.connectionId,
  time: messages.createdAt,
}

/**
 * Deletes the matching messages of one workspace in a single transaction; recipients,
 * attachments and events cascade. Blobs left without reference are collected by the
 * retention job (doc 02, « blobs »). Returns the number of deleted messages.
 */
export async function purgeMessages(db: Database, p: MessagePurge): Promise<number> {
  return db.transaction(async (tx) => {
    if (p.includeLogs) {
      // Before the messages: their deletion sets webhook_deliveries.message_id to null.
      const targeted = tx.select({ id: messages.id }).from(messages).where(scope(p, messageScope))
      await tx
        .delete(webhookDeliveries)
        .where(
          and(
            eq(webhookDeliveries.workspaceId, p.workspaceId),
            inArray(webhookDeliveries.messageId, targeted),
          ),
        )
      await tx.delete(apiLogs).where(
        scope(p, {
          workspace: apiLogs.workspaceId,
          connection: apiLogs.connectionId,
          time: apiLogs.createdAt,
        }),
      )
      await tx.delete(smtpSessions).where(
        scope(p, {
          workspace: smtpSessions.workspaceId,
          connection: smtpSessions.connectionId,
          time: smtpSessions.startedAt,
        }),
      )
    }
    const purged = await tx
      .delete(messages)
      .where(scope(p, messageScope))
      .returning({ id: messages.id })
    return purged.length
  })
}
