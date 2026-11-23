import { asc, eq, inArray, sql } from 'drizzle-orm'
import type { Executor } from '../client'
import { messageEvents } from '../schema/events'
import { messageRecipients, messages } from '../schema/messages'
import type { DeliveryStatusValue } from './messages-read'

export type NewMessageEventRow = typeof messageEvents.$inferInsert

export interface SimulatedMessage {
  id: string
  workspaceId: string
  connectionId: string | null
  status: DeliveryStatusValue
  /** Decision snapshot of earlier simulation runs (`messages.simulation`). */
  simulation: Record<string, unknown> | null
}

export interface SimulatedRecipient {
  id: string
  email: string
  status: DeliveryStatusValue
}

/**
 * Reads the message and row-locks it until the end of the transaction, so two workers
 * holding the same job (expired lease) apply its transitions one after the other.
 * Undefined when the message is gone (purged, workspace deleted).
 */
export async function lockMessage(
  db: Executor,
  messageId: string,
): Promise<SimulatedMessage | undefined> {
  const [row] = await db
    .select({
      id: messages.id,
      workspaceId: messages.workspaceId,
      connectionId: messages.connectionId,
      status: messages.status,
      simulation: messages.simulation,
    })
    .from(messages)
    .where(eq(messages.id, messageId))
    .for('update')
  return row
}

/** Recipients in a stable order (insertion order of their time-sortable ids). */
export async function listRecipientsForSimulation(
  db: Executor,
  messageId: string,
): Promise<SimulatedRecipient[]> {
  return db
    .select({
      id: messageRecipients.id,
      email: messageRecipients.email,
      status: messageRecipients.status,
    })
    .from(messageRecipients)
    .where(eq(messageRecipients.messageId, messageId))
    .orderBy(asc(messageRecipients.id))
}

export async function setRecipientsStatus(
  db: Executor,
  recipientIds: readonly string[],
  status: DeliveryStatusValue,
  reason: string | null = null,
): Promise<void> {
  if (recipientIds.length === 0) return
  await db
    .update(messageRecipients)
    .set({ status, statusReason: reason, updatedAt: sql`now()` })
    .where(inArray(messageRecipients.id, [...recipientIds]))
}

export async function setMessageStatus(
  db: Executor,
  messageId: string,
  status: DeliveryStatusValue,
): Promise<void> {
  await db
    .update(messages)
    .set({ status, statusUpdatedAt: sql`now()` })
    .where(eq(messages.id, messageId))
}

export async function insertMessageEvents(db: Executor, rows: NewMessageEventRow[]): Promise<void> {
  if (rows.length === 0) return
  await db.insert(messageEvents).values(rows)
}

/** Stores the decision snapshot of the simulation (`MessageDetail.simulation`). */
export async function setMessageSimulation(
  db: Executor,
  messageId: string,
  simulation: Record<string, unknown>,
): Promise<void> {
  await db.update(messages).set({ simulation }).where(eq(messages.id, messageId))
}
