import {
  ListTemplatesQuery,
  TemplateInput,
  TemplateParams,
  TemplatePatch,
  WorkspaceRef,
} from '@mailsink/contracts'
import {
  createTemplate,
  getTemplateView,
  listTemplateViews,
  patchTemplate as patchTemplateService,
  removeTemplate,
} from '@mailsink/core'
import { z } from 'zod'
import { defineApi } from '../handler'

// Brevo templates of a workspace (#30), Admin key only. `:id` is an id or a slug,
// `:templateId` the numeric `externalId` that Brevo calls `templateId`.

const WorkspaceParams = z.object({ id: WorkspaceRef })

/** `GET /admin/workspaces/:id/templates?cursor=&limit=`: ascending externalId. */
export const listTemplates = defineApi({
  auth: 'admin',
  params: WorkspaceParams,
  query: ListTemplatesQuery,
  handler: ({ runtime, params, query }) => listTemplateViews(runtime.db.db, params.id, query),
})

/** `POST /admin/workspaces/:id/templates`: 201, 409 when the externalId is taken. */
export const postTemplate = defineApi({
  auth: 'admin',
  params: WorkspaceParams,
  body: TemplateInput,
  handler: async ({ runtime, params, body }) =>
    Response.json(await createTemplate(runtime.db.db, params.id, body), { status: 201 }),
})

/** `GET /admin/workspaces/:id/templates/:templateId`. */
export const getTemplate = defineApi({
  auth: 'admin',
  params: TemplateParams,
  handler: ({ runtime, params }) => getTemplateView(runtime.db.db, params.id, params.templateId),
})

/** `PATCH /admin/workspaces/:id/templates/:templateId`: absent fields are kept. */
export const patchTemplate = defineApi({
  auth: 'admin',
  params: TemplateParams,
  body: TemplatePatch,
  handler: ({ runtime, params, body }) =>
    patchTemplateService(runtime.db.db, params.id, params.templateId, body),
})

/** `DELETE /admin/workspaces/:id/templates/:templateId`: 204. */
export const deleteTemplate = defineApi({
  auth: 'admin',
  params: TemplateParams,
  handler: async ({ runtime, params }) => {
    await removeTemplate(runtime.db.db, params.id, params.templateId)
    return new Response(null, { status: 204 })
  },
})
