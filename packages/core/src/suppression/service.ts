import type {
  DeleteSuppressionsResponse,
  ListSuppressionsQuery,
  ListSuppressionsResponse,
  SuppressionView,
} from '@mailsink/contracts'
import {
  countSuppressions,
  deleteSuppressions,
  type Executor,
  type ListedSuppression,
  listSuppressions,
} from '@mailsink/db'

// The list is fed by the simulation (hard_bounce, complained: simulation/recorder.ts) and
// read by ingestion (recipients on it are stored `suppressed`, ingestion/pipeline.ts).

export function toSuppressionView(row: ListedSuppression): SuppressionView {
  return {
    id: row.id,
    email: row.email,
    reason: row.reason,
    messageId: row.messageId,
    connectionId: row.connectionId,
    createdAt: row.createdAt.toISOString(),
  }
}

/**
 * `GET /capture/suppressions`: newest first, keyset cursor (the id of the last row), with the
 * total of the filter and the connection of the message behind each address.
 */
export async function listSuppressionViews(
  db: Executor,
  workspaceId: string,
  query: ListSuppressionsQuery,
): Promise<ListSuppressionsResponse> {
  const [rows, total] = await Promise.all([
    listSuppressions(db, workspaceId, {
      email: query.email,
      after: query.cursor,
      limit: query.limit + 1,
    }),
    countSuppressions(db, workspaceId, query.email),
  ])
  const page = rows.slice(0, query.limit)
  const last = page.at(-1)
  return {
    data: page.map(toSuppressionView),
    nextCursor: rows.length > query.limit && last ? last.id : null,
    total,
  }
}

/** `DELETE /capture/suppressions[?email=]`: one address, or the whole list. */
export async function resetSuppressions(
  db: Executor,
  workspaceId: string,
  email?: string,
): Promise<DeleteSuppressionsResponse> {
  return { count: await deleteSuppressions(db, workspaceId, email) }
}
