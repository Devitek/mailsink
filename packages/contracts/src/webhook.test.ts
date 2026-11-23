import { describe, expect, it } from 'vitest'
import { defaultPayloadFormat, WebhookEndpointInput, WebhookEndpointPatch } from './webhook'
import { ReplayRequest } from './webhook-delivery'

describe('webhook contracts', () => {
  it('defaults the payload format from the scope (D20)', () => {
    expect(defaultPayloadFormat({ kind: 'resend' })).toBe('resend')
    expect(defaultPayloadFormat({ kind: 'brevo' })).toBe('brevo')
    expect(defaultPayloadFormat({ kind: 'smtp' })).toBe('unified')
    expect(defaultPayloadFormat(null)).toBe('unified')
  })

  it('validates endpoint input', () => {
    const base = { connectionId: null, url: 'https://x.io/h', events: ['email.sent'] }
    expect(WebhookEndpointInput.parse(base)).toEqual(base)
    expect(WebhookEndpointInput.safeParse({ ...base, url: 'ftp://x.io' }).success).toBe(false)
    expect(WebhookEndpointInput.safeParse({ ...base, events: [] }).success).toBe(false)
    expect(
      WebhookEndpointInput.safeParse({
        ...base,
        brevoAuth: { type: 'basic', username: 'a:b', password: 'p' },
      }).success,
    ).toBe(false)
    expect(
      WebhookEndpointInput.safeParse({ ...base, customHeaders: [{ key: 'bad header', value: '' }] })
        .success,
    ).toBe(false)
    expect(WebhookEndpointPatch.parse({ rotateSecret: true })).toEqual({ rotateSecret: true })
    expect(ReplayRequest.parse({})).toEqual({ mode: 'exact' })
  })
})
