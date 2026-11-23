import * as C from '@mailsink/contracts'
import { seg, type Transport } from '../http'
import type { QueryValue } from '../query'
import type {
  ListTemplatesParams,
  Template,
  TemplateInput,
  TemplatePage,
  TemplatePatch,
} from '../types'

/** Brevo templates of a workspace (Admin key); `templateId` is the numeric Brevo id. */
export function templatesApi(t: Transport) {
  const path = (ref: string, templateId?: number) =>
    `/admin/workspaces/${seg(ref)}/templates${templateId === undefined ? '' : `/${templateId}`}`
  return {
    list: (ref: string, params: ListTemplatesParams = {}) =>
      t.json<TemplatePage>({
        method: 'GET',
        path: path(ref),
        auth: 'admin',
        query: params as Record<string, QueryValue>,
        schema: C.ListTemplatesResponse,
      }),
    create: (ref: string, input: TemplateInput) =>
      t.json<Template>({
        method: 'POST',
        path: path(ref),
        auth: 'admin',
        body: input,
        schema: C.TemplateView,
      }),
    get: (ref: string, templateId: number) =>
      t.json<Template>({
        method: 'GET',
        path: path(ref, templateId),
        auth: 'admin',
        schema: C.TemplateView,
      }),
    update: (ref: string, templateId: number, patch: TemplatePatch) =>
      t.json<Template>({
        method: 'PATCH',
        path: path(ref, templateId),
        auth: 'admin',
        body: patch,
        schema: C.TemplateView,
      }),
    delete: (ref: string, templateId: number) =>
      t.json<void>({ method: 'DELETE', path: path(ref, templateId), auth: 'admin' }),
  }
}

export type TemplatesApi = ReturnType<typeof templatesApi>
