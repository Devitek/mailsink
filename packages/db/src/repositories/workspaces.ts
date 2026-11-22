import { and, desc, eq, lt, or, type SQL } from 'drizzle-orm'
import type { Executor } from '../client'
import { workspaces } from '../schema/workspaces'

export type Workspace = typeof workspaces.$inferSelect
export type NewWorkspace = typeof workspaces.$inferInsert

/**
 * Workspace named by an id or a slug: `:id` of the Admin API, `X-Mailsink-Workspace` when
 * the Admin key acts on a workspace (D12).
 */
export async function findWorkspaceByRef(
  db: Executor,
  ref: string,
): Promise<Workspace | undefined> {
  const [row] = await db
    .select()
    .from(workspaces)
    .where(or(eq(workspaces.id, ref), eq(workspaces.slug, ref)))
    .limit(1)
  return row
}

export async function insertWorkspace(db: Executor, row: NewWorkspace): Promise<Workspace> {
  const [inserted] = await db.insert(workspaces).values(row).returning()
  if (!inserted) throw new Error('workspace not inserted')
  return inserted
}

export interface ListWorkspacesOptions {
  includeEphemeral: boolean
  /** Id of the last workspace of the previous page (exclusive). */
  after?: string
  limit: number
}

/**
 * Newest first. Ids are UUIDv7 text (D25), so ordering by id is ordering by creation and
 * the last id of a page is a stable keyset cursor.
 */
export async function listWorkspaces(
  db: Executor,
  options: ListWorkspacesOptions,
): Promise<Workspace[]> {
  const filters: SQL[] = []
  if (!options.includeEphemeral) filters.push(eq(workspaces.ephemeral, false))
  if (options.after) filters.push(lt(workspaces.id, options.after))
  return db
    .select()
    .from(workspaces)
    .where(and(...filters))
    .orderBy(desc(workspaces.id))
    .limit(options.limit)
}

/** Hard delete; every workspace-owned row goes with it (FK cascades). */
export async function deleteWorkspace(db: Executor, id: string): Promise<boolean> {
  const rows = await db
    .delete(workspaces)
    .where(eq(workspaces.id, id))
    .returning({ id: workspaces.id })
  return rows.length > 0
}
