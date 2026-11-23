import { createHmac } from 'node:crypto'
import { UnifiedWebhookPayload } from '@mailsink/contracts'
import { describe, expect, it } from 'vitest'
import { generateWebhookSecret } from '../secret'
import { ctx, custom, ts } from './test-fixture'
import { unifiedFormatter } from './unified'

describe('unified formatter', () => {
  it('serializes the unified payload and signs "<timestamp>.<body>"', () => {
    const body = unifiedFormatter.serialize(ctx('email.hard_bounced'))
    const payload = UnifiedWebhookPayload.parse(JSON.parse(body))
    expect(payload).toMatchObject({
      event: 'email.hard_bounced',
      connectionKind: 'resend',
      recipient: 'jane@example.com',
      detail: { smtpCode: 550 },
    })
    const secret = generateWebhookSecret()
    const endpoint = { secret, brevoAuth: 'none' as const, customHeaders: custom }
    const headers = unifiedFormatter.sign({
      deliveryId: payload.id,
      body,
      endpoint,
      timestamp: ts,
      canonical: 'email.hard_bounced',
    })
    const expected = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex')
    expect(headers).toEqual({
      'X-Team': 'mail',
      'Content-Type': 'application/json',
      'X-Mailsink-Event': 'email.hard_bounced',
      'X-Mailsink-Delivery-Id': payload.id,
      'X-Mailsink-Timestamp': String(ts),
      'X-Mailsink-Signature': `sha256=${expected}`,
    })
  })
})
