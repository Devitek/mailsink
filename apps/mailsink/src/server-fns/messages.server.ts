import { ListMessagesQuery } from '@mailsink/contracts'
import {
  DomainError,
  getCapturedMessage,
  type InboxFacets,
  type InboxPage,
  listInboxRows,
  purgeCapturedMessages,
  readInboxFacets,
  readMessagePreviews,
  readRawMessage,
} from '@mailsink/core'
import { findWorkspaceByRef, type Workspace } from '@mailsink/db'
import { type InboxFilters, toListQuery } from '../features/inbox/search-query'
import { inboxPaths } from '../features/inbox/ui-paths'
import type { Runtime } from '../runtime/container'
import type { RawSource, ViewerMessage } from './messages-types'

// Inbox reads and writes of the UI server functions (#39, #40): the core capture services,
// scoped to the workspace of the URL. Not defineApi routes, so the activity touch of D86 is
// explicit, like opening the workspace.

/** Rows per inbox page: the list is virtual, pages only bound one round trip. */
export const INBOX_PAGE_SIZE = 100
/** Raw sources above this are cut in the viewer (the download keeps every byte). */
export const RAW_SOURCE_MAX_BYTES = 512 * 1024

/** The workspace of a UI URL, by slug only (as `openWorkspace`); touches its activity. */
export async function workspaceOfSlug(runtime: Runtime, slug: string): Promise<Workspace> {
  const workspace = await findWorkspaceByRef(runtime.db.db, slug)
  if (!workspace || workspace.slug !== slug) {
    throw new DomainError('not_found', 'Workspace not found')
  }
  await runtime.activity.touch(workspace.id)
  return workspace
}

export async function readInboxPage(
  runtime: Runtime,
  slug: string,
  filters: InboxFilters,
  cursor?: string,
): Promise<InboxPage> {
  const { id } = await workspaceOfSlug(runtime, slug)
  const query = ListMessagesQuery.parse(toListQuery(filters, cursor, INBOX_PAGE_SIZE))
  return listInboxRows(runtime.db.db, id, query)
}

export async function readFacets(runtime: Runtime, slug: string): Promise<InboxFacets> {
  const { id } = await workspaceOfSlug(runtime, slug)
  return readInboxFacets(runtime.db.db, id)
}

export async function readPreviews(
  runtime: Runtime,
  slug: string,
  ids: string[],
): Promise<Record<string, string>> {
  const { id } = await workspaceOfSlug(runtime, slug)
  return readMessagePreviews(runtime.db.db, id, ids)
}

/** The message, its download URLs pointing at the session routes of the inbox. */
export async function readMessage(
  runtime: Runtime,
  slug: string,
  messageId: string,
): Promise<ViewerMessage> {
  const { id } = await workspaceOfSlug(runtime, slug)
  const {
    metadata: _metadata,
    simulation: _simulation,
    ...detail
  } = await getCapturedMessage(runtime.db.db, id, messageId)
  return {
    ...detail,
    rawUrl: inboxPaths.raw(slug, detail.id),
    attachments: detail.attachments.map((a) => ({
      ...a,
      downloadUrl: inboxPaths.attachment(slug, detail.id, a.id),
    })),
  }
}

/** The MIME source as text for the viewer, cut at RAW_SOURCE_MAX_BYTES; null when none. */
export async function readRawSource(
  runtime: Runtime,
  slug: string,
  messageId: string,
): Promise<RawSource | null> {
  const { id } = await workspaceOfSlug(runtime, slug)
  try {
    const data = await readRawMessage(runtime.db.db, id, messageId)
    const head = data.subarray(0, RAW_SOURCE_MAX_BYTES)
    return {
      text: new TextDecoder('utf-8').decode(head),
      sizeBytes: data.byteLength,
      truncated: data.byteLength > head.byteLength,
    }
  } catch (error) {
    if (error instanceof DomainError && error.code === 'not_found') {
      // A missing message stays an error; a message without raw source is not.
      await getCapturedMessage(runtime.db.db, id, messageId)
      return null
    }
    throw error
  }
}

/**
 * « Purge the inbox »: every message of the workspace. The logs are kept (the Logs tab has
 * its own lifecycle), unlike the `DELETE /capture/messages` default. Publishes
 * `messages.purged` like the Capture route.
 */
export async function purgeInbox(runtime: Runtime, slug: string): Promise<{ count: number }> {
  const { id } = await workspaceOfSlug(runtime, slug)
  const purged = await purgeCapturedMessages(runtime.db.db, id, { includeLogs: false })
  runtime.bus.publish(id, {
    id: null,
    connectionId: null,
    event: { type: 'messages.purged', count: purged.count },
  })
  return purged
}
