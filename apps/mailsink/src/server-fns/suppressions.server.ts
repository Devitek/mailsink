import {
  type DeleteSuppressionsResponse,
  ListSuppressionsQuery,
  type ListSuppressionsResponse,
} from '@mailsink/contracts'
import { listSuppressionViews, resetSuppressions } from '@mailsink/core'
import type { Runtime } from '../runtime/container'
import { workspaceOfSlug } from './messages.server'

// Suppression list of the web UI (#42): the core suppression services, scoped to the
// workspace of the URL (by slug, activity touched), like `/capture/suppressions`.

/** Rows per page of the suppression table. */
export const SUPPRESSIONS_PAGE_SIZE = 50

export type SuppressionsPageQuery = { email?: string; cursor?: string; limit?: number }

export async function readSuppressionsPage(
  runtime: Runtime,
  slug: string,
  query: SuppressionsPageQuery,
): Promise<ListSuppressionsResponse> {
  const { id } = await workspaceOfSlug(runtime, slug)
  const parsed = ListSuppressionsQuery.parse({
    limit: query.limit ?? SUPPRESSIONS_PAGE_SIZE,
    email: query.email?.trim() || undefined,
    cursor: query.cursor,
  })
  return listSuppressionViews(runtime.db.db, id, parsed)
}

/** One address (exact, case-insensitive as stored), or the whole list when omitted. */
export async function removeSuppressions(
  runtime: Runtime,
  slug: string,
  email?: string,
): Promise<DeleteSuppressionsResponse> {
  const { id } = await workspaceOfSlug(runtime, slug)
  return resetSuppressions(runtime.db.db, id, email)
}
