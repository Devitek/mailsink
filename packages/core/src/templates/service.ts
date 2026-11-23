import type {
  ListTemplatesQuery,
  ListTemplatesResponse,
  TemplateInput,
  TemplatePatch,
  TemplateView,
} from '@mailsink/contracts'
import {
  type Database,
  deleteTemplate,
  type Executor,
  findTemplateByExternalId,
  findWorkspaceByRef,
  insertTemplates,
  listTemplates,
  maxTemplateExternalId,
  updateTemplate,
} from '@mailsink/db'
import { DomainError } from '../errors'
import { isTemplateIdConflict, planTemplates, templateIdTaken, toTemplateView } from './views'

// Admin API of the Brevo templates (#30): `/admin/workspaces/:id/templates[/:templateId]`,
// `:id` an id or a slug, `:templateId` the numeric `externalId` (Brevo `templateId`).

const templateNotFound = (externalId: number) =>
  new DomainError('not_found', `Template ${externalId} not found`)

/** Id of the workspace an Admin route designates by id or slug, else 404. */
export async function resolveWorkspaceId(db: Executor, ref: string): Promise<string> {
  const workspace = await findWorkspaceByRef(db, ref)
  if (!workspace) throw new DomainError('not_found', 'Workspace not found')
  return workspace.id
}

/** Inserts templates (seed or creation), mapping a taken `externalId` to 409 `conflict`. */
export async function insertTemplateInputs(
  tx: Executor,
  workspaceId: string,
  inputs: readonly TemplateInput[],
  now: Date = new Date(),
): Promise<TemplateView[]> {
  if (inputs.length === 0) return []
  const highest = await maxTemplateExternalId(tx, workspaceId)
  const rows = planTemplates(workspaceId, inputs, highest, now)
  try {
    return (await insertTemplates(tx, rows)).map(toTemplateView)
  } catch (error) {
    if (isTemplateIdConflict(error)) throw templateIdTaken()
    throw error
  }
}

export async function createTemplate(
  db: Database,
  workspaceRef: string,
  input: TemplateInput,
): Promise<TemplateView> {
  const workspaceId = await resolveWorkspaceId(db, workspaceRef)
  const existing =
    input.externalId === undefined
      ? undefined
      : await findTemplateByExternalId(db, workspaceId, input.externalId)
  if (existing) throw templateIdTaken(input.externalId)
  const [view] = await db.transaction((tx) => insertTemplateInputs(tx, workspaceId, [input]))
  if (!view) throw new Error('template not inserted')
  return view
}

/** One page in ascending `externalId`; `nextCursor` is the last `externalId` of the page. */
export async function listTemplateViews(
  db: Executor,
  workspaceRef: string,
  query: ListTemplatesQuery,
): Promise<ListTemplatesResponse> {
  const workspaceId = await resolveWorkspaceId(db, workspaceRef)
  const rows = await listTemplates(db, workspaceId, {
    after: query.cursor,
    limit: query.limit + 1,
  })
  const page = rows.slice(0, query.limit)
  const last = page.at(-1)
  return {
    data: page.map(toTemplateView),
    nextCursor: rows.length > query.limit && last ? String(last.externalId) : null,
  }
}

export async function getTemplateView(
  db: Executor,
  workspaceRef: string,
  externalId: number,
): Promise<TemplateView> {
  const workspaceId = await resolveWorkspaceId(db, workspaceRef)
  const row = await findTemplateByExternalId(db, workspaceId, externalId)
  if (!row) throw templateNotFound(externalId)
  return toTemplateView(row)
}

/** Partial update; a template left without html nor text is refused (422). */
export async function patchTemplate(
  db: Database,
  workspaceRef: string,
  externalId: number,
  patch: TemplatePatch,
): Promise<TemplateView> {
  const workspaceId = await resolveWorkspaceId(db, workspaceRef)
  return db.transaction(async (tx) => {
    const current = await findTemplateByExternalId(tx, workspaceId, externalId)
    if (!current) throw templateNotFound(externalId)
    const html = patch.html === undefined ? current.html : patch.html
    const text = patch.text === undefined ? current.text : patch.text
    if (!html && !text) {
      throw new DomainError('validation_error', 'A template needs html or text', {
        details: {
          in: 'body',
          issues: [
            {
              path: ['html'],
              code: 'custom',
              message: 'html or text is required',
              params: { code: 'html_or_text_required' },
            },
          ],
        },
      })
    }
    const row = await updateTemplate(tx, workspaceId, externalId, {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.subject !== undefined ? { subject: patch.subject } : {}),
      ...(patch.html !== undefined ? { html: patch.html } : {}),
      ...(patch.text !== undefined ? { text: patch.text } : {}),
      ...(patch.sender !== undefined ? { sender: patch.sender } : {}),
    })
    if (!row) throw templateNotFound(externalId)
    return toTemplateView(row)
  })
}

export async function removeTemplate(
  db: Executor,
  workspaceRef: string,
  externalId: number,
): Promise<void> {
  const workspaceId = await resolveWorkspaceId(db, workspaceRef)
  if (!(await deleteTemplate(db, workspaceId, externalId))) throw templateNotFound(externalId)
}
