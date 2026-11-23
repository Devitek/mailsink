import { and, desc, eq, ilike, lt, type SQL } from 'drizzle-orm'
import type { Executor } from '../client'
import { suppressions } from '../schema/suppressions'

export type Suppression = typeof suppressions.$inferSelect
export type NewSuppression = typeof suppressions.$inferInsert

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

/** Newest first: ids are UUIDv7 text (D25), so the last id of a page is the cursor. */
export async function listSuppressions(
  db: Executor,
  workspaceId: string,
  options: ListSuppressionsOptions,
): Promise<Suppression[]> {
  const filters: SQL[] = [eq(suppressions.workspaceId, workspaceId)]
  if (options.email) filters.push(ilike(suppressions.email, `%${escapeLike(options.email)}%`))
  if (options.after) filters.push(lt(suppressions.id, options.after))
  return db
    .select()
    .from(suppressions)
    .where(and(...filters))
    .orderBy(desc(suppressions.id))
    .limit(options.limit)
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
