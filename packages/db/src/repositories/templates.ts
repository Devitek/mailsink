import { and, asc, eq, gt, max } from 'drizzle-orm'
import type { Executor } from '../client'
import { templates } from '../schema/templates'

export type Template = typeof templates.$inferSelect
export type NewTemplate = typeof templates.$inferInsert
export type TemplateChanges = Partial<
  Pick<NewTemplate, 'name' | 'subject' | 'html' | 'text' | 'sender'>
>

/** Inserts templates; a taken `(workspace_id, external_id)` fails with `templates_external_uq`. */
export async function insertTemplates(db: Executor, rows: NewTemplate[]): Promise<Template[]> {
  if (rows.length === 0) return []
  return db.insert(templates).values(rows).returning()
}

/** Highest `external_id` of the workspace, 0 when it has no template. */
export async function maxTemplateExternalId(db: Executor, workspaceId: string): Promise<number> {
  const [row] = await db
    .select({ value: max(templates.externalId) })
    .from(templates)
    .where(eq(templates.workspaceId, workspaceId))
  return row?.value ?? 0
}

/** The template a Brevo `templateId` designates in the workspace. */
export async function findTemplateByExternalId(
  db: Executor,
  workspaceId: string,
  externalId: number,
): Promise<Template | undefined> {
  const [row] = await db
    .select()
    .from(templates)
    .where(and(eq(templates.workspaceId, workspaceId), eq(templates.externalId, externalId)))
  return row
}

/** Ascending `external_id`, after the cursor (exclusive). */
export async function listTemplates(
  db: Executor,
  workspaceId: string,
  options: { after?: number; limit: number },
): Promise<Template[]> {
  return db
    .select()
    .from(templates)
    .where(
      and(
        eq(templates.workspaceId, workspaceId),
        options.after === undefined ? undefined : gt(templates.externalId, options.after),
      ),
    )
    .orderBy(asc(templates.externalId))
    .limit(options.limit)
}

export async function updateTemplate(
  db: Executor,
  workspaceId: string,
  externalId: number,
  changes: TemplateChanges,
  now: Date = new Date(),
): Promise<Template | undefined> {
  const [row] = await db
    .update(templates)
    .set({ ...changes, updatedAt: now })
    .where(and(eq(templates.workspaceId, workspaceId), eq(templates.externalId, externalId)))
    .returning()
  return row
}

/** True when a template was deleted. */
export async function deleteTemplate(
  db: Executor,
  workspaceId: string,
  externalId: number,
): Promise<boolean> {
  const rows = await db
    .delete(templates)
    .where(and(eq(templates.workspaceId, workspaceId), eq(templates.externalId, externalId)))
    .returning({ id: templates.id })
  return rows.length > 0
}
