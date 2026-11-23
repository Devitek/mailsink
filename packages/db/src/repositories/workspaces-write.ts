import { eq } from 'drizzle-orm'
import type { Executor } from '../client'
import { workspaces } from '../schema/workspaces'
import type { Workspace } from './workspaces'

/** Settings the web UI edits on an existing workspace (#38); the slug never changes. */
export type WorkspacePatch = Partial<
  Pick<Workspace, 'name' | 'description' | 'retentionSeconds' | 'rateLimit'>
>

export async function updateWorkspace(
  db: Executor,
  id: string,
  patch: WorkspacePatch,
  now: Date = new Date(),
): Promise<Workspace | undefined> {
  const [row] = await db
    .update(workspaces)
    .set({ ...patch, updatedAt: now })
    .where(eq(workspaces.id, id))
    .returning()
  return row
}
