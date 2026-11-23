import type { Chaos } from '@mailsink/contracts'
import { describe, expect, it } from 'vitest'
import { chaosSmtpReply } from '../chaos/smtp-reply'
import { guardRequest, smtpGuardReply } from './request-guard'
import { createRateLimiter } from './token-bucket'

const always = () => 0
const never = () => 0.999
const chaos: Chaos = { errorRate: 50, httpCodes: [502], smtpCodes: [452] }

function guard(
  surface: 'http' | 'smtp',
  settings: Parameters<typeof guardRequest>[0]['settings'],
  random = never,
) {
  const limiter = createRateLimiter({ now: () => 0 })
  return (connectionId = 'con_a') =>
    guardRequest({ surface, connectionId, settings, limiter, random })
}

describe('guardRequest', () => {
  it('passes without rate limit nor chaos, with no decision', () => {
    expect(guard('http', { rateLimit: null, chaos: null })()).toEqual({
      rateLimit: null,
      rejection: null,
    })
  })

  it('rejects once the bucket is empty, before drawing chaos', () => {
    const next = guard('smtp', { rateLimit: { limit: 1, windowSeconds: 3 }, chaos }, () => {
      throw new Error('no draw on a rate limited call')
    })
    const first = () => {
      try {
        return next()
      } catch {
        return 'drew'
      }
    }
    expect(first()).toBe('drew')
    const verdict = next()
    expect(verdict.rejection).toEqual({ reason: 'rate_limited' })
    expect(smtpGuardReply(verdict)).toEqual({
      responseCode: 451,
      message: '4.7.1 Rate limit exceeded, retry in 3s',
    })
  })

  it('draws chaos per surface once the token is taken', () => {
    const rateLimit = { limit: 5, windowSeconds: 1 }
    const http = guard('http', { rateLimit, chaos }, always)()
    expect(http).toMatchObject({
      rateLimit: { allowed: true, remaining: 4 },
      rejection: { reason: 'chaos_injected', code: 502 },
    })
    const smtp = guard('smtp', { rateLimit: null, chaos }, always)()
    expect(smtpGuardReply(smtp)).toEqual({
      responseCode: 452,
      message: '4.3.1 Insufficient system storage (chaos injected)',
    })
    expect(smtpGuardReply(guard('smtp', { rateLimit: null, chaos })())).toBeNull()
  })

  it('maps every chaos SMTP code to its enhanced status', () => {
    expect([421, 451, 452, 550].map((c) => chaosSmtpReply(c as 421).message.slice(0, 5))).toEqual([
      '4.3.2',
      '4.3.0',
      '4.3.1',
      '5.7.1',
    ])
  })
})
