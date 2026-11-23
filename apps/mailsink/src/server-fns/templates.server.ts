import type { TemplateInput, TemplatePatch, TemplateView } from '@mailsink/contracts'
import {
  createTemplate,
  isDomainError,
  listTemplateViews,
  patchTemplate,
  removeTemplate,
  renderTemplate,
} from '@mailsink/core'
import type { Runtime } from '../runtime/container'
import { touchWorkspace } from './connections.server'
import { fieldIssues } from './webhooks.server'
import type { FieldIssue } from './webhooks-types'

// Brevo templates of the settings screen (#43): the core services of the Admin template
// API (#30) with the UI session, workspace by slug, activity touched (D163).

/** Templates per page of the settings list (« Load more » reads the next one). */
export const TEMPLATE_PAGE_SIZE = 200

/** One page of templates by `externalId`; `nextCursor` reads the next one. */
export type TemplatePage = { data: TemplateView[]; nextCursor: string | null }

export type TemplateSaved =
  | { ok: true; template: TemplateView }
  | { ok: false; issues: FieldIssue[] }

export type TemplatePreviewInput = {
  subject: string
  html: string
  text: string
  params: Record<string, unknown>
  contactEmail: string
}

export type TemplatePreview = { subject: string; html: string; text: string }

export async function listTemplates(
  runtime: Runtime,
  slug: string,
  cursor?: number,
  limit = TEMPLATE_PAGE_SIZE,
): Promise<TemplatePage> {
  const workspaceId = await touchWorkspace(runtime, slug)
  return listTemplateViews(runtime.db.db, workspaceId, { cursor, limit })
}

async function saving(write: () => Promise<TemplateView>): Promise<TemplateSaved> {
  try {
    return { ok: true, template: await write() }
  } catch (error) {
    if (isDomainError(error) && error.code === 'conflict') {
      return {
        ok: false,
        issues: [{ path: 'externalId', code: 'conflict', message: error.message }],
      }
    }
    const issues = fieldIssues(error)
    if (issues) return { ok: false, issues }
    throw error
  }
}

export async function addTemplate(
  runtime: Runtime,
  slug: string,
  input: TemplateInput,
): Promise<TemplateSaved> {
  const workspaceId = await touchWorkspace(runtime, slug)
  return saving(() => createTemplate(runtime.db.db, workspaceId, input))
}

export async function changeTemplate(
  runtime: Runtime,
  slug: string,
  externalId: number,
  patch: TemplatePatch,
): Promise<TemplateSaved> {
  const workspaceId = await touchWorkspace(runtime, slug)
  return saving(() => patchTemplate(runtime.db.db, workspaceId, externalId, patch))
}

export async function deleteTemplate(
  runtime: Runtime,
  slug: string,
  externalId: number,
): Promise<void> {
  const workspaceId = await touchWorkspace(runtime, slug)
  await removeTemplate(runtime.db.db, workspaceId, externalId)
}

/**
 * The editor's preview (D203): the Brevo renderer of `POST /v3/smtp/email` (D126) on the
 * unsaved fields, with sample `params` and `contact.EMAIL`; html values are escaped.
 */
export async function previewTemplate(
  runtime: Runtime,
  slug: string,
  input: TemplatePreviewInput,
): Promise<TemplatePreview> {
  await touchWorkspace(runtime, slug)
  const context = { params: input.params, contact: { EMAIL: input.contactEmail } }
  return {
    subject: renderTemplate(input.subject, context),
    html: renderTemplate(input.html, context, { html: true }),
    text: renderTemplate(input.text, context),
  }
}
