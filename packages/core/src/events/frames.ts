import type { DeliveryStatus, MessageEventView, MessageSummary } from '@mailsink/contracts'
import {
  type Executor,
  findWorkspaceMessagesByIds,
  listRecipients,
  type MessageEventRow,
  type StreamEventRow,
} from '@mailsink/db'
import { toSummary } from '../capture/views'
import type { StreamFrame } from './bus'

// One `message_events` row gives exactly one frame with the row id, live and on replay
// (proposition D80): `accepted` -> `message.created`, any other type -> `message.event`.

export function toEventView(row: MessageEventRow): MessageEventView {
  return {
    id: row.id,
    type: row.type,
    origin: row.origin,
    recipient: row.recipientEmail,
    data: row.data ?? {},
    occurredAt: row.occurredAt.toISOString(),
  }
}

export function createdFrame(acceptedEventId: string, message: MessageSummary): StreamFrame {
  return {
    id: acceptedEventId,
    connectionId: message.connectionId,
    event: { type: 'message.created', message },
  }
}

export function eventFrame(row: MessageEventRow, connectionId: string | null): StreamFrame {
  return { id: row.id, connectionId, event: { type: 'message.event', event: toEventView(row) } }
}

/** Aggregated message status (recipient null): derived, so it carries no SSE id. */
export function statusFrame(
  messageId: string,
  status: DeliveryStatus,
  connectionId: string | null,
): StreamFrame {
  return {
    id: null,
    connectionId,
    event: { type: 'message.status', messageId, status, recipient: null },
  }
}

/**
 * Frames of stored event rows, in row order. `accepted` rows load their message summary;
 * a message deleted in the meantime drops its frame.
 */
export async function framesOfRows(
  db: Executor,
  workspaceId: string,
  rows: readonly StreamEventRow[],
): Promise<StreamFrame[]> {
  const createdIds = rows.filter((r) => r.type === 'accepted').map((r) => r.messageId)
  const summaries = await loadSummaries(db, workspaceId, [...new Set(createdIds)])
  return rows.flatMap((row) => {
    if (row.type !== 'accepted') return [eventFrame(row, row.connectionId)]
    const summary = summaries.get(row.messageId)
    return summary ? [createdFrame(row.id, summary)] : []
  })
}

async function loadSummaries(
  db: Executor,
  workspaceId: string,
  ids: string[],
): Promise<Map<string, MessageSummary>> {
  const [messages, recipients] = await Promise.all([
    findWorkspaceMessagesByIds(db, workspaceId, ids),
    listRecipients(db, ids),
  ])
  return new Map(
    messages.map((m) => [
      m.id,
      toSummary(
        m,
        recipients.filter((r) => r.messageId === m.id),
      ),
    ]),
  )
}
