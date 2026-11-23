import {
  Address,
  type AddressOut,
  type TemplateInputRaw,
  type TemplatePatch,
  type TemplateView,
} from '@mailsink/contracts'
import { z } from 'zod'

// Values, validation and request mapping of the Brevo template editor (#43). The numeric id
// is the `templateId` of `POST /v3/smtp/email`: set at creation (blank = next free one),
// never changed afterwards.

export type TemplateValues = {
  externalId: string
  name: string
  subject: string
  html: string
  text: string
  /** `Name <email>` or a bare address; blank = the request must give a sender. */
  sender: string
}

export const templateDefaults = (): TemplateValues => ({
  externalId: '',
  name: '',
  subject: '',
  html: '',
  text: '',
  sender: '',
})

export const senderText = (sender: AddressOut | null): string =>
  sender ? (sender.name ? `${sender.name} <${sender.email}>` : sender.email) : ''

export const templateValues = (view: TemplateView): TemplateValues => ({
  externalId: String(view.externalId),
  name: view.name,
  subject: view.subject,
  html: view.html ?? '',
  text: view.text ?? '',
  sender: senderText(view.sender),
})

export type TemplateMessages = { required: string; body: string; id: string; sender: string }

const ID_RE = /^\s*([1-9]\d{0,9})?\s*$/

export const templateSchema = (m: TemplateMessages) =>
  z
    .object({
      externalId: z
        .string()
        .regex(ID_RE, m.id)
        .refine((v) => v.trim() === '' || Number(v) <= 2_147_483_647, m.id),
      name: z.string().trim().min(1, m.required).max(200),
      subject: z.string().max(998),
      html: z.string(),
      text: z.string(),
      sender: z.string().refine((v) => v.trim() === '' || Address.safeParse(v).success, m.sender),
    })
    .superRefine((v, ctx) => {
      if (v.html.trim() === '' && v.text.trim() === '') {
        ctx.addIssue({ code: 'custom', message: m.body, path: ['html'] })
      }
    })

const orNull = (value: string) => (value.trim() === '' ? null : value)

export function toTemplateInput(values: TemplateValues): TemplateInputRaw {
  const id = values.externalId.trim()
  return {
    ...(id ? { externalId: Number(id) } : {}),
    name: values.name.trim(),
    subject: values.subject,
    html: orNull(values.html),
    text: orNull(values.text),
    ...(values.sender.trim() ? { sender: values.sender.trim() } : {}),
  }
}

export function toTemplatePatch(values: TemplateValues): z.input<typeof TemplatePatch> {
  return {
    name: values.name.trim(),
    subject: values.subject,
    html: orNull(values.html),
    text: orNull(values.text),
    sender: orNull(values.sender.trim()),
  }
}

/** Sample `params` typed by the user: a JSON object, blank = `{}`. */
export function parseParams(
  text: string,
): { ok: true; params: Record<string, unknown> } | { ok: false } {
  if (text.trim() === '') return { ok: true, params: {} }
  try {
    const value: unknown = JSON.parse(text)
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return { ok: true, params: value as Record<string, unknown> }
    }
  } catch {
    // reported below
  }
  return { ok: false }
}
