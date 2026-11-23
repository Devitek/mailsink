import type {
  ConnectionKind,
  DeliveryStatus,
  ListMessagesQuery,
  MessageSummary,
} from '@mailsink/contracts'
import {
  countMessageFacets,
  countWorkspaceLogs,
  type Database,
  listConnections,
  listMessageExcerpts,
} from '@mailsink/db'
import { previewText } from './preview'
import { listCapturedMessages } from './service'

// Web UI inbox (#39): the Capture list with a body preview per row, and the facet counts
// of the filter bar and the workspace tabs. Same workspace scoping as the Capture API.

export type InboxRow = MessageSummary & { preview: string }
export type InboxPage = { data: InboxRow[]; nextCursor: string | null }

export interface InboxConnectionFacet {
  id: string
  name: string
  kind: ConnectionKind
  count: number
}

export interface InboxFacets {
  total: number
  byStatus: Partial<Record<DeliveryStatus, number>>
  /** Every connection of the workspace, oldest first, with its message count. */
  connections: InboxConnectionFacet[]
  /** API calls, SMTP sessions and webhook deliveries (the Logs tab counter). */
  logs: number
}

/** Previews of the given messages of the workspace, by message id. */
export async function readMessagePreviews(
  db: Database,
  workspaceId: string,
  messageIds: string[],
): Promise<Record<string, string>> {
  const excerpts = await listMessageExcerpts(db, workspaceId, messageIds)
  return Object.fromEntries(excerpts.map((e) => [e.id, previewText(e)]))
}

/** One page of the inbox: `listCapturedMessages` plus the previews. */
export async function listInboxRows(
  db: Database,
  workspaceId: string,
  query: ListMessagesQuery,
): Promise<InboxPage> {
  const page = await listCapturedMessages(db, workspaceId, query)
  const previews = await readMessagePreviews(
    db,
    workspaceId,
    page.data.map((m) => m.id),
  )
  return {
    data: page.data.map((m) => ({ ...m, preview: previews[m.id] ?? '' })),
    nextCursor: page.nextCursor,
  }
}

export async function readInboxFacets(db: Database, workspaceId: string): Promise<InboxFacets> {
  const [counts, connections, logs] = await Promise.all([
    countMessageFacets(db, workspaceId),
    listConnections(db, workspaceId),
    countWorkspaceLogs(db, workspaceId),
  ])
  const perConnection = new Map(counts.byConnection.map((c) => [c.connectionId, c.count]))
  return {
    total: counts.byStatus.reduce((sum, s) => sum + s.count, 0),
    byStatus: Object.fromEntries(counts.byStatus.map((s) => [s.status, s.count])),
    connections: connections.map((c) => ({
      id: c.id,
      name: c.name,
      kind: c.kind,
      count: perConnection.get(c.id) ?? 0,
    })),
    logs,
  }
}
