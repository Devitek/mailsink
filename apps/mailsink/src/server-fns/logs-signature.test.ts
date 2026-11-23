import { svixSignature, unifiedSignature } from '@mailsink/core'
import { describe, expect, it } from 'vitest'
import { checkSignature } from './logs-signature'

const SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw'
const OTHER = 'whsec_C2FVsBQIhrscChlQIMV+b5sSYspob7oD'
const body = '{"type":"email.delivered"}'
const secrets = (secret: string | null, brevoAuth: 'none' | 'bearer' | 'basic' = 'none') => ({
  secret,
  brevoAuth,
  customHeaders: [],
})
const base = { canonicalEvent: 'email.delivered' as const, body }

describe('webhook signature check', () => {
  it('checks a unified signature with the current secret', () => {
    const headers = {
      'X-Mailsink-Delivery-Id': 'whd_1',
      'X-Mailsink-Timestamp': '1795430400',
      'X-Mailsink-Signature': `sha256=${unifiedSignature(SECRET, 1795430400, body)}`,
    }
    const check = (secret: string) =>
      checkSignature({ ...base, payloadFormat: 'unified', headers, endpoint: secrets(secret) })
    expect(check(SECRET)).toBe('valid')
    expect(check(OTHER)).toBe('invalid')
  })

  it('checks a Svix signature with the id and timestamp sent', () => {
    const headers = {
      'svix-id': 'whd_1',
      'svix-timestamp': '1795430400',
      'svix-signature': svixSignature(SECRET, 'whd_1', 1795430400, body),
    }
    const check = (h: Record<string, string>) =>
      checkSignature({ ...base, payloadFormat: 'resend', headers: h, endpoint: secrets(SECRET) })
    expect(check(headers)).toBe('valid')
    expect(check({ ...headers, 'svix-timestamp': '1795430401' })).toBe('invalid')
    expect(check({ 'svix-id': 'whd_1' })).toBe('missing')
  })

  it('compares the Brevo Authorization header with the current credentials', () => {
    const check = (headers: Record<string, string>, auth: 'none' | 'bearer') =>
      checkSignature({
        ...base,
        payloadFormat: 'brevo',
        headers,
        endpoint: secrets(auth === 'none' ? null : 'tok', auth),
      })
    expect(check({ Authorization: 'Bearer tok' }, 'bearer')).toBe('valid')
    expect(check({ Authorization: 'Bearer old' }, 'bearer')).toBe('invalid')
    expect(check({}, 'none')).toBe('unsigned')
  })
})
