import type { TemplateInput, TemplateView } from '@mailsink/contracts'
import { type NewTemplate, newId, type Template } from '@mailsink/db'
import { DomainError } from '../errors'

export function toTemplateView(row: Template): TemplateView {
  return {
    id: row.id,
    externalId: row.externalId,
    name: row.name,
    subject: row.subject,
    html: row.html,
    text: row.text,
    sender: row.sender ? { email: row.sender.email, name: row.sender.name ?? null } : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export const templateIdTaken = (externalId?: number) =>
  new DomainError(
    'conflict',
    externalId === undefined
      ? 'This template id is already used in the workspace'
      : `Template id ${externalId} is already used in the workspace`,
  )

/**
 * Rows for a list of templates of one workspace: explicit `externalId`s are kept, the others
 * get the next free ids after `highestTaken` and every explicit id, in input order. Two inputs
 * with the same explicit id answer 409 `conflict`.
 */
export function planTemplates(
  workspaceId: string,
  inputs: readonly TemplateInput[],
  highestTaken: number,
  now: Date,
): NewTemplate[] {
  const explicit = new Set<number>()
  for (const input of inputs) {
    if (input.externalId === undefined) continue
    if (explicit.has(input.externalId)) throw templateIdTaken(input.externalId)
    explicit.add(input.externalId)
  }
  let next = Math.max(highestTaken, ...explicit) + 1
  return inputs.map((input) => ({
    id: newId('tpl', now.getTime()),
    workspaceId,
    externalId: input.externalId ?? next++,
    name: input.name,
    subject: input.subject,
    html: input.html ?? null,
    text: input.text ?? null,
    sender: input.sender ?? null,
    createdAt: now,
    updatedAt: now,
  }))
}

/** True when `error` is the unique violation of `templates_external_uq` (nested in `cause`). */
export function isTemplateIdConflict(error: unknown): boolean {
  let current: unknown = error
  while (current && typeof current === 'object') {
    if ('code' in current && current.code === '23505') {
      return 'constraint' in current && current.constraint === 'templates_external_uq'
    }
    current = 'cause' in current ? current.cause : undefined
  }
  return false
}
