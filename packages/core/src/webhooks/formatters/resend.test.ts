import { ResendWebhookPayload } from '@mailsink/contracts'
import { Webhook } from 'svix'
import { describe, expect, it } from 'vitest'
import { generateWebhookSecret } from '../secret'
import { resendFormatter } from './resend'
import { ctx } from './test-fixture'

describe('resend formatter', () => {
  it('emits Resend payloads verified by the svix package', () => {
    const secret = generateWebhookSecret()
    const c = ctx('email.hard_bounced')
    const body = resendFormatter.serialize(c)
    const payload = ResendWebhookPayload.parse(JSON.parse(body))
    expect(payload.type).toBe('email.bounced')
    expect(payload.data.bounce?.type).toBe('Permanent')
    expect(payload.data.email_id).toBe('00000000-0000-7000-8000-000000000000')
    expect(payload.data.tags).toEqual({ category: 'test' })
    const fresh = Math.floor(Date.now() / 1000)
    const headers = resendFormatter.sign({
      deliveryId: c.delivery.id,
      body,
      endpoint: { secret, brevoAuth: 'none', customHeaders: [] },
      timestamp: fresh,
      canonical: 'email.hard_bounced',
    })
    expect(headers['svix-id']).toBe(c.delivery.id)
    expect(() => new Webhook(secret).verify(body, headers)).not.toThrow()
    expect(() => new Webhook(generateWebhookSecret()).verify(body, headers)).toThrow()
  })

  it('maps soft bounces to delivery_delayed and carries click details', () => {
    expect(JSON.parse(resendFormatter.serialize(ctx('email.soft_bounced'))).type).toBe(
      'email.delivery_delayed',
    )
    const click = ResendWebhookPayload.parse(
      JSON.parse(resendFormatter.serialize(ctx('email.clicked'))),
    )
    expect(click.data.click?.link).toBe('https://example.com/')
    expect(resendFormatter.eventName('email.suppressed')).toBeNull()
  })

  it('emits an invalid address as email.failed with a reason (Resend has no invalid event)', () => {
    const payload = ResendWebhookPayload.parse(
      JSON.parse(resendFormatter.serialize(ctx('email.invalid'))),
    )
    expect(payload.type).toBe('email.failed')
    expect(payload.data.failed?.reason).toBeTypeOf('string')
  })
})
