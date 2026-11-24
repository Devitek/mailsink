import { WebhookEndpointInput, WebhookEndpointPatch } from '@mailsink/contracts'
import { describe, expect, it } from 'vitest'
import { eventCatalog } from '../../server-fns/settings-catalog'
import type { EndpointRow } from '../../server-fns/webhooks-types'
import {
  endpointDefaults,
  endpointSchema,
  endpointValues,
  formatForScope,
  isChoiceOn,
  toEndpointInput,
  toEndpointPatch,
  toggleChoice,
  unsupportedEvents,
} from './endpoint-form'

const catalog = eventCatalog()
const connections = [
  { id: 'con_resend', name: 'resend-main', kind: 'resend' as const, disabled: false },
  { id: 'con_smtp', name: 'smtp-legacy', kind: 'smtp' as const, disabled: false },
]
const messages = { url: 'url', events: 'events', header: 'header', required: 'required' }

describe('endpoint form', () => {
  it('prefills the format from the scope: native for resend / brevo, unified otherwise', () => {
    expect(formatForScope(connections, '')).toBe('unified')
    expect(formatForScope(connections, 'con_resend')).toBe('resend')
    expect(formatForScope(connections, 'con_smtp')).toBe('unified')
    expect(endpointDefaults()).toMatchObject({ payloadFormat: 'unified', formatEdited: false })
  })

  it('toggles a dialect choice as the canonical events it stands for', () => {
    const delayed = catalog.resend.find((c) => c.name === 'email.delivery_delayed')
    if (!delayed) throw new Error('expected the choice')
    const on = toggleChoice(['email.delivered'], delayed)
    expect(on).toEqual(['email.delivered', 'email.deferred', 'email.soft_bounced'])
    expect(isChoiceOn(on, delayed)).toBe(true)
    expect(toggleChoice(on, delayed)).toEqual(['email.delivered'])
  })

  it('reports the events a format cannot represent', () => {
    expect(unsupportedEvents(catalog, 'resend', ['email.suppressed', 'email.opened'])).toEqual([
      'email.suppressed',
    ])
    expect(unsupportedEvents(catalog, 'brevo', ['email.failed'])).toEqual([])
    expect(unsupportedEvents(catalog, 'unified', ['email.failed'])).toEqual([])
  })

  it('builds a creation request: canonical events, Brevo auth on brevo only', () => {
    const values = {
      ...endpointDefaults(),
      url: 'https://hooks.test/a',
      events: ['email.hard_bounced' as const],
      payloadFormat: 'brevo' as const,
      brevoAuthType: 'basic' as const,
      brevoUsername: 'u',
      brevoPassword: 'p',
      customHeaders: [
        { key: 'X-Env', value: 'qa' },
        { key: ' ', value: '' },
      ],
    }
    expect(WebhookEndpointInput.parse(toEndpointInput(values))).toEqual({
      connectionId: null,
      url: 'https://hooks.test/a',
      payloadFormat: 'brevo',
      events: ['email.hard_bounced'],
      brevoAuth: { type: 'basic', username: 'u', password: 'p' },
      customHeaders: [{ key: 'X-Env', value: 'qa' }],
      enabled: true,
    })
    expect(toEndpointInput({ ...values, payloadFormat: 'unified' }).brevoAuth).toBeUndefined()
  })

  it('keeps stored Brevo credentials when the fields are left blank on edit', () => {
    const row = {
      id: 'whe_1',
      connectionId: null,
      url: 'https://hooks.test/b',
      payloadFormat: 'brevo',
      events: ['hardBounce'],
      canonicalEvents: ['email.hard_bounced'],
      unsupportedEvents: [],
      description: null,
      brevoAuth: { type: 'bearer' },
      customHeaders: [],
      secretPreview: null,
      enabled: true,
    } as unknown as EndpointRow
    const values = endpointValues(row)
    expect(values).toMatchObject({ formatEdited: true, brevoAuthType: 'bearer', brevoToken: '' })
    const patch = WebhookEndpointPatch.parse(toEndpointPatch(values, row))
    expect(patch.brevoAuth).toBeUndefined()
    expect(patch).toMatchObject({ url: 'https://hooks.test/b', description: null })
    const schema = endpointSchema(messages, row.brevoAuth)
    expect(schema.safeParse(values).success).toBe(true)
    const switched = { ...values, brevoAuthType: 'basic' as const }
    expect(schema.safeParse(switched).error?.issues[0]?.path).toEqual(['brevoUsername'])
  })

  it('refuses a bad url, no event and an invalid header name', () => {
    const result = endpointSchema(messages, null).safeParse({
      ...endpointDefaults(),
      url: 'ftp://x',
      events: [],
      customHeaders: [{ key: 'bad header', value: '' }],
    })
    const paths = result.error?.issues.map((i) => i.path.join('.'))
    expect(paths).toEqual(['url', 'events', 'customHeaders.0.key'])
  })
})
