import { z } from 'zod'
import { Address, AddressOut } from './address'
import { IsoDateTime, issue, Page, PageLimit } from './common'
import { prefixedId, WorkspaceRef } from './ids'

// Brevo templates of a workspace (#30): the `templateId` of `POST /v3/smtp/email` is the
// numeric `externalId`, unique per workspace. Subject, html and text may hold
// `{{ params.x }}` and `{{ contact.X }}` placeholders (core/templates/render.ts).

export const TemplateId = prefixedId('tpl')

/** Brevo template id: positive 32-bit integer (Postgres `integer`). */
export const TemplateExternalId = z.coerce.number().int().positive().max(2_147_483_647)

const MAX_BODY_CHARS = 1_000_000

const TemplateFields = {
  name: z.string().trim().min(1).max(200),
  subject: z.string().max(998),
  html: z.string().max(MAX_BODY_CHARS).nullable().optional(),
  text: z.string().max(MAX_BODY_CHARS).nullable().optional(),
  /** Default sender of the emails sent with this template, unless the request sets one. */
  sender: Address.nullable().optional(),
}

const hasBody = (t: { html?: string | null; text?: string | null }) => Boolean(t.html || t.text)

/** `POST /admin/workspaces/:id/templates` and the `templates` seed of a new workspace. */
export const TemplateInput = z
  .object({
    /** Brevo `templateId`; the next free id of the workspace when absent. */
    externalId: TemplateExternalId.optional(),
    ...TemplateFields,
  })
  .refine(hasBody, issue('html_or_text_required', 'html or text is required', ['html']))

/** `PATCH /admin/workspaces/:id/templates/:templateId`: absent fields are kept. */
export const TemplatePatch = z
  .object({
    name: TemplateFields.name.optional(),
    subject: TemplateFields.subject.optional(),
    html: TemplateFields.html,
    text: TemplateFields.text,
    sender: TemplateFields.sender,
  })
  .refine((p) => Object.values(p).some((v) => v !== undefined), {
    message: 'At least one field is required',
    params: { code: 'empty_patch' },
  })

export const TemplateView = z.object({
  id: TemplateId,
  externalId: z.number().int(),
  name: z.string(),
  subject: z.string(),
  html: z.string().nullable(),
  text: z.string().nullable(),
  sender: AddressOut.nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
})

/** `:templateId` of the Admin template routes: the numeric `externalId`. */
export const TemplateParams = z.object({ id: WorkspaceRef, templateId: TemplateExternalId })

/** Ascending `externalId`; `nextCursor` is the `externalId` of the last row. */
export const ListTemplatesQuery = z.object({
  cursor: TemplateExternalId.optional(),
  limit: PageLimit,
})
export const ListTemplatesResponse = Page(TemplateView)

/** At most this many templates in the `templates` seed of `POST /admin/workspaces`. */
export const MAX_SEEDED_TEMPLATES = 500
export const TemplateSeed = z.array(TemplateInput).max(MAX_SEEDED_TEMPLATES)

export type TemplateInput = z.output<typeof TemplateInput>
export type TemplateInputRaw = z.input<typeof TemplateInput>
export type TemplatePatch = z.output<typeof TemplatePatch>
export type TemplateView = z.output<typeof TemplateView>
export type ListTemplatesQuery = z.output<typeof ListTemplatesQuery>
export type ListTemplatesResponse = z.output<typeof ListTemplatesResponse>
