import { Slug, TemplateExternalId, TemplateInput, TemplatePatch } from '@mailsink/contracts'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  addTemplate,
  changeTemplate,
  deleteTemplate,
  listTemplates,
  previewTemplate,
} from './templates.server'
import { signedIn } from './workspaces-fns'

// Brevo template server functions of the settings screen (#43), session-checked.

const MAX_BODY = 1_000_000
const Target = z.object({ slug: Slug, externalId: TemplateExternalId })

export const listTemplatesFn = createServerFn({ method: 'GET' })
  .middleware([signedIn])
  .validator(z.object({ slug: Slug }))
  .handler(({ context, data }) => listTemplates(context.runtime, data.slug))

export const createTemplateFn = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(z.object({ slug: Slug, template: TemplateInput }))
  .handler(({ context, data }) => addTemplate(context.runtime, data.slug, data.template))

export const updateTemplateFn = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(Target.extend({ patch: TemplatePatch }))
  .handler(({ context, data }) =>
    changeTemplate(context.runtime, data.slug, data.externalId, data.patch),
  )

export const deleteTemplateFn = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(Target)
  .handler(({ context, data }) => deleteTemplate(context.runtime, data.slug, data.externalId))

export const previewTemplateFn = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(
    z.object({
      slug: Slug,
      subject: z.string().max(998),
      html: z.string().max(MAX_BODY),
      text: z.string().max(MAX_BODY),
      params: z.record(z.string(), z.unknown()),
      contactEmail: z.string().max(320),
    }),
  )
  .handler(({ context, data }) => {
    const { slug, ...input } = data
    return previewTemplate(context.runtime, slug, input)
  })
