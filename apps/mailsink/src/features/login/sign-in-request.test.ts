import { describe, expect, it } from 'vitest'
import { formatCountdown, parseRetryAfter, requestSignIn } from './sign-in-request'

const answer = (status: number, headers: Record<string, string> = {}) =>
  (async () => new Response(status === 204 ? null : '{}', { status, headers })) as typeof fetch

describe('requestSignIn', () => {
  it('maps the answers of POST /login', async () => {
    expect(await requestSignIn('k', answer(204))).toEqual({ kind: 'signed-in' })
    expect(await requestSignIn('k', answer(401))).toEqual({ kind: 'rejected' })
    expect(await requestSignIn('k', answer(429, { 'retry-after': '42' }))).toEqual({
      kind: 'paused',
      retryAfter: 42,
    })
    expect(await requestSignIn('k', answer(500))).toEqual({ kind: 'failed' })
    const offline = (async () => {
      throw new TypeError('network')
    }) as typeof fetch
    expect(await requestSignIn('k', offline)).toEqual({ kind: 'failed' })
  })

  it('posts the key as JSON to /login', async () => {
    let seen: Request | undefined
    const spy = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seen = new Request(new URL(String(input), 'http://localhost'), init)
      return new Response(null, { status: 204 })
    }) as typeof fetch
    await requestSignIn('msk_admin_x', spy)
    expect(seen?.method).toBe('POST')
    expect(new URL(seen?.url ?? '').pathname).toBe('/login')
    expect(await seen?.json()).toEqual({ key: 'msk_admin_x' })
  })
})

describe('countdown helpers', () => {
  it('reads Retry-After seconds, with a safe default', () => {
    expect(parseRetryAfter('5')).toBe(5)
    expect(parseRetryAfter(null)).toBe(60)
    expect(parseRetryAfter('Wed, 21 Oct 2015 07:28:00 GMT')).toBe(60)
  })

  it('formats minutes and seconds', () => {
    expect(formatCountdown(42)).toBe('0:42')
    expect(formatCountdown(65)).toBe('1:05')
    expect(formatCountdown(0.2)).toBe('0:01')
    expect(formatCountdown(-3)).toBe('0:00')
  })
})
