import { BrevoWebhookPayload } from '@mailsink/contracts'
import { describe, expect, it } from 'vitest'
import { brevoDate, brevoFormatter } from './brevo'
import { ctx, custom, now, ts } from './test-fixture'

describe('brevo formatter', () => {
  it('serializes Brevo payloads with the numeric id and the workspace timezone', () => {
    const body = brevoFormatter.serialize(ctx('email.soft_bounced', 'Europe/Paris'))
    const payload = BrevoWebhookPayload.parse(JSON.parse(body))
    expect(payload).toMatchObject({
      event: 'soft_bounce',
      email: 'jane@example.com',
      id: 42,
      date: '2026-11-23 11:00:00',
      ts,
      ts_epoch: now.getTime(),
      reason: 'Mailbox full',
      tag: 'test',
      source: 'API',
    })
    expect(payload['message-id']).toMatch(/^<.+@smtp-relay\.mailin\.fr>$/)
    expect(brevoDate(now, 'Not/AZone')).toBe('2026-11-23 10:00:00')
    expect(brevoFormatter.eventName('email.failed')).toBeNull()
  })

  it('authenticates with bearer or basic auth and custom headers, never a signature', () => {
    const base = {
      deliveryId: 'whd_1',
      body: '{}',
      timestamp: ts,
      canonical: 'email.sent' as const,
    }
    expect(
      brevoFormatter.sign({
        ...base,
        endpoint: { secret: 'tok', brevoAuth: 'bearer', customHeaders: custom },
      }),
    ).toEqual({ 'X-Team': 'mail', 'Content-Type': 'application/json', Authorization: 'Bearer tok' })
    expect(
      brevoFormatter.sign({
        ...base,
        endpoint: { secret: 'u:p', brevoAuth: 'basic', customHeaders: [] },
      }).Authorization,
    ).toBe(`Basic ${Buffer.from('u:p').toString('base64')}`)
    expect(
      brevoFormatter.sign({
        ...base,
        endpoint: { secret: null, brevoAuth: 'none', customHeaders: [] },
      }),
    ).toEqual({ 'Content-Type': 'application/json' })
  })
})
