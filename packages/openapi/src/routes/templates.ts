import {
  ListTemplatesQuery,
  ListTemplatesResponse,
  TemplateInput,
  TemplateParams,
  TemplatePatch,
  TemplateView,
  WorkspaceRef,
} from '@mailsink/contracts'
import { z } from 'zod'
import type { RouteSpec } from '../route'

const Ref = z.object({ id: WorkspaceRef })
const admin = { tag: 'Admin', auth: 'admin' } as const

/** Brevo templates of a workspace (03-contracts, « Brevo templates »): Admin key only. */
export const TEMPLATE_ROUTES: RouteSpec[] = [
  {
    ...admin,
    operationId: 'listTemplates',
    method: 'get',
    path: '/admin/workspaces/{id}/templates',
    summary: 'List the Brevo templates of a workspace',
    params: Ref,
    query: ListTemplatesQuery,
    success: [{ status: 200, description: 'One page.', schema: ListTemplatesResponse }],
  },
  {
    ...admin,
    operationId: 'createTemplate',
    method: 'post',
    path: '/admin/workspaces/{id}/templates',
    summary: 'Create a Brevo template',
    params: Ref,
    body: TemplateInput,
    success: [{ status: 201, description: 'Created.', schema: TemplateView }],
    errors: ['conflict'],
  },
  {
    ...admin,
    operationId: 'getTemplate',
    method: 'get',
    path: '/admin/workspaces/{id}/templates/{templateId}',
    summary: 'Brevo template detail',
    params: TemplateParams,
    success: [{ status: 200, description: 'The template.', schema: TemplateView }],
  },
  {
    ...admin,
    operationId: 'updateTemplate',
    method: 'patch',
    path: '/admin/workspaces/{id}/templates/{templateId}',
    summary: 'Edit a Brevo template',
    params: TemplateParams,
    body: TemplatePatch,
    success: [{ status: 200, description: 'The template.', schema: TemplateView }],
  },
  {
    ...admin,
    operationId: 'deleteTemplate',
    method: 'delete',
    path: '/admin/workspaces/{id}/templates/{templateId}',
    summary: 'Delete a Brevo template',
    params: TemplateParams,
    success: [{ status: 204, description: 'Deleted.' }],
  },
]
