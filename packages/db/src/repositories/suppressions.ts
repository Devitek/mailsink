import { and, count, desc, eq, getTableColumns, ilike, lt, type SQL } from 'drizzle-orm'
import type { Executor } from '../client'
import { messages } from '../schema/messages'
import { suppressions } from '../schema/suppressions'

export type Suppression = typeof suppressions.$inferSelect
export type NewSuppression = typeof suppressions.$inferInsert
/** A listed address with the connection of the message that put it there (if still kept). */
export type ListedSuppression = Suppression & { connectionId: string | null }

/**
 * Adds addresses to the suppression list; an address already listed keeps its first row
 * (reason and message). Returns the rows actually inserted.
 */
export async function addSuppressions(
  db: Executor,
  rows: NewSuppression[],
): Promise<Suppression[]> {
  if (rows.length === 0) return []
  return db
    .insert(suppressions)
    .values(rows)
    .onConflictDoNothing({ target: [suppressions.workspaceId, suppressions.email] })
    .returning()
}

export interface ListSuppressionsOptions {
  /** Case-insensitive substring of the address. */
  email?: string
  /** Id of the last row of the previous page (exclusive). */
  after?: string
  limit: number
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&')

function filtersOf(workspaceId: string, email: string | undefined): SQL[] {
  const filters: SQL[] = [eq(suppressions.workspaceId, workspaceId)]
  if (email) filters.push(ilike(suppressions.email, `%${escapeLike(email)}%`))
  return filters
}

/** Newest first: ids are UUIDv7 text (D25), so the last id of a page is the cursor. */
export async function listSuppressions(
  db: Executor,
  workspaceId: string,
  options: ListSuppressionsOptions,
): Promise<ListedSuppression[]> {
  const filters = filtersOf(workspaceId, options.email)
  if (options.after) filters.push(lt(suppressions.id, options.after))
  return db
    .select({ ...getTableColumns(suppressions), connectionId: messages.connectionId })
    .from(suppressions)
    .leftJoin(messages, eq(messages.id, suppressions.messageId))
    .where(and(...filters))
    .orderBy(desc(suppressions.id))
    .limit(options.limit)
}

/** Addresses of the list matching the filter (the total of the UI). */
export async function countSuppressions(
  db: Executor,
  workspaceId: string,
  email?: string,
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(suppressions)
    .where(and(...filtersOf(workspaceId, email)))
  return row?.n ?? 0
}

/** Removes one address (lower-cased) or, without `email`, the whole list. Returns the count. */
export async function deleteSuppressions(
  db: Executor,
  workspaceId: string,
  email?: string,
): Promise<number> {
  const rows = await db
    .delete(suppressions)
    .where(
      and(
        eq(suppressions.workspaceId, workspaceId),
        email === undefined ? undefined : eq(suppressions.email, email),
      ),
    )
    .returning({ id: suppressions.id })
  return rows.length
}
