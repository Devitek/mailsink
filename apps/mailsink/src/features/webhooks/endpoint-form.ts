import {
  type BrevoAuth,
  CanonicalEvent,
  defaultPayloadFormat,
  type PayloadFormat,
  type WebhookEndpointInput,
  type WebhookEndpointPatch,
} from '@mailsink/contracts'
import { z } from 'zod'
import type { EventCatalog, EventChoice, SettingsConnection } from '../../server-fns/settings-types'
import type { EndpointRow } from '../../server-fns/webhooks-types'

// Values, validation and request mapping of the webhook endpoint form (#43). Events are
// kept canonical in the form (the stored form, D22) and shown in the dialect of the
// format; a format change keeps them and warns about those it cannot represent.

export type BrevoAuthType = 'none' | 'bearer' | 'basic'
export type HeaderValue = { key: string; value: string }

export type EndpointValues = {
  /** Empty = Workspace scope (every connection). */
  connectionId: string
  payloadFormat: PayloadFormat
  /** Set once the user picks a format: the scope no longer prefills it. */
  formatEdited: boolean
  url: string
  description: string
  events: CanonicalEvent[]
  brevoAuthType: BrevoAuthType
  brevoToken: string
  brevoUsername: string
  brevoPassword: string
  customHeaders: HeaderValue[]
  enabled: boolean
}

export const endpointDefaults = (): EndpointValues => ({
  connectionId: '',
  payloadFormat: 'unified',
  formatEdited: false,
  url: '',
  description: '',
  events: ['email.delivered'],
  brevoAuthType: 'none',
  brevoToken: '',
  brevoUsername: '',
  brevoPassword: '',
  customHeaders: [],
  enabled: true,
})

/** Values of an existing endpoint; credentials are write-only, so their fields start blank. */
export function endpointValues(row: EndpointRow): EndpointValues {
  return {
    ...endpointDefaults(),
    connectionId: row.connectionId ?? '',
    payloadFormat: row.payloadFormat,
    formatEdited: true,
    url: row.url,
    description: row.description ?? '',
    events: [...row.canonicalEvents],
    brevoAuthType: row.brevoAuth.type,
    brevoUsername: row.brevoAuth.username ?? '',
    customHeaders: row.customHeaders.map((h) => ({ ...h })),
    enabled: row.enabled,
  }
}

/** Format prefilled for a scope (D20): the connection's own, unified for SMTP or Workspace. */
export function formatForScope(
  connections: readonly SettingsConnection[],
  connectionId: string,
): PayloadFormat {
  return defaultPayloadFormat(connections.find((c) => c.id === connectionId) ?? null)
}

const sorted = (events: Iterable<CanonicalEvent>) => {
  const set = new Set(events)
  return CanonicalEvent.options.filter((e) => set.has(e))
}

export const isChoiceOn = (events: readonly CanonicalEvent[], choice: EventChoice) =>
  choice.events.every((e) => events.includes(e))

export function toggleChoice(events: readonly CanonicalEvent[], choice: EventChoice) {
  if (isChoiceOn(events, choice)) return events.filter((e) => !choice.events.includes(e))
  return sorted([...events, ...choice.events])
}

/** Selected events `format` has no name for: kept, never sent (D22). */
export function unsupportedEvents(
  catalog: EventCatalog,
  format: PayloadFormat,
  events: readonly CanonicalEvent[],
): CanonicalEvent[] {
  const known = new Set(catalog[format].flatMap((c) => c.events))
  return events.filter((e) => !known.has(e))
}

export type EndpointMessages = { url: string; events: string; header: string; required: string }

const HEADER_RE = /^[A-Za-z0-9!#$%&'*+.^_`|~-]{1,100}$/

export type StoredAuth = { type: BrevoAuthType; username?: string } | null

/** `stored`: Brevo auth already saved; its credentials are kept while left blank. */
export const endpointSchema = (m: EndpointMessages, stored: StoredAuth) =>
  z
    .object({
      url: z.url({ protocol: /^https?$/, error: m.url }).max(2000, m.url),
      events: z.array(z.string()).min(1, m.events),
      customHeaders: z.array(
        z.object({
          key: z.string().refine((k) => k.trim() === '' || HEADER_RE.test(k.trim()), m.header),
          value: z.string().max(1000),
        }),
      ),
    })
    .loose()
    .superRefine((raw, ctx) => {
      const v = raw as unknown as EndpointValues
      if (v.payloadFormat !== 'brevo') return
      const need = (path: keyof EndpointValues, value: string) => {
        if (value.trim() === '') ctx.addIssue({ code: 'custom', message: m.required, path: [path] })
      }
      const kept = v.brevoAuthType === stored?.type
      if (v.brevoAuthType === 'bearer' && !kept) need('brevoToken', v.brevoToken)
      if (v.brevoAuthType !== 'basic') return
      need('brevoUsername', v.brevoUsername)
      if (kept && v.brevoUsername !== stored?.username) need('brevoPassword', v.brevoPassword)
    })

function brevoAuthOf(values: EndpointValues): BrevoAuth {
  if (values.brevoAuthType === 'bearer') return { type: 'bearer', token: values.brevoToken }
  if (values.brevoAuthType === 'basic') {
    return { type: 'basic', username: values.brevoUsername, password: values.brevoPassword }
  }
  return { type: 'none' }
}

const headersOf = (values: EndpointValues) =>
  values.customHeaders
    .filter((h) => h.key.trim() !== '')
    .map((h) => ({ key: h.key.trim(), value: h.value }))

export function toEndpointInput(values: EndpointValues): z.input<typeof WebhookEndpointInput> {
  const description = values.description.trim()
  return {
    connectionId: values.connectionId || null,
    url: values.url.trim(),
    payloadFormat: values.payloadFormat,
    events: values.events,
    ...(description ? { description } : {}),
    ...(values.payloadFormat === 'brevo' ? { brevoAuth: brevoAuthOf(values) } : {}),
    customHeaders: headersOf(values),
    enabled: values.enabled,
  }
}

/** Every editable field; Brevo auth only when its type changed or credentials were typed. */
export function toEndpointPatch(values: EndpointValues, row: EndpointRow): WebhookEndpointPatch {
  const typed = values.brevoToken !== '' || values.brevoPassword !== ''
  const authChanged =
    values.brevoAuthType !== row.brevoAuth.type ||
    typed ||
    (values.brevoAuthType === 'basic' && values.brevoUsername !== row.brevoAuth.username)
  return {
    connectionId: values.connectionId || null,
    url: values.url.trim(),
    payloadFormat: values.payloadFormat,
    events: values.events,
    description: values.description.trim() || null,
    customHeaders: headersOf(values),
    ...(values.payloadFormat === 'brevo' && authChanged ? { brevoAuth: brevoAuthOf(values) } : {}),
  }
}
