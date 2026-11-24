import { describe, expect, it } from 'vitest'
import { sendWebhook } from './send'
import { basicAuthorization, redactUrl, splitUrlCredentials } from './url-credentials'

describe('webhook URL credentials', () => {
  it('splits basic auth credentials out of the URL, decoded', () => {
    expect(splitUrlCredentials('https://acme:p%40ss%3Aw@hooks.example.com/brevo?token=1')).toEqual({
      url: 'https://hooks.example.com/brevo?token=1',
      basic: { username: 'acme', password: 'p@ss:w' },
    })
    expect(splitUrlCredentials('https://acme@hooks.example.com/x')).toEqual({
      url: 'https://hooks.example.com/x',
      basic: { username: 'acme', password: '' },
    })
  })

  it('leaves a URL without credentials untouched', () => {
    expect(splitUrlCredentials('https://hooks.example.com')).toEqual({
      url: 'https://hooks.example.com',
      basic: null,
    })
    expect(splitUrlCredentials('not a url')).toEqual({ url: 'not a url', basic: null })
  })

  it('builds the Authorization header and redacts URLs for views', () => {
    expect(basicAuthorization({ username: 'u', password: 'p' })).toBe(
      `Basic ${Buffer.from('u:p').toString('base64')}`,
    )
    expect(redactUrl('https://u:secret@hooks.example.com/x')).toBe('https://hooks.example.com/x')
    expect(redactUrl('https://hooks.example.com/x')).toBe('https://hooks.example.com/x')
  })

  it('sends a URL stored with credentials as an Authorization header (rows before D278)', async () => {
    const calls: { url: string; headers: Record<string, string> }[] = []
    const fetch = async (url: string, init: RequestInit) => {
      calls.push({ url, headers: init.headers as Record<string, string> })
      return new Response(null, { status: 204 })
    }
    await sendWebhook('https://u:p@hooks.example.com/x', { 'Content-Type': 'json' }, '{}', {
      fetch,
    })
    await sendWebhook('https://u:p@hooks.example.com/x', { authorization: 'Bearer t' }, '{}', {
      fetch,
    })
    expect(calls).toEqual([
      {
        url: 'https://hooks.example.com/x',
        headers: {
          'Content-Type': 'json',
          Authorization: basicAuthorization({ username: 'u', password: 'p' }),
        },
      },
      { url: 'https://hooks.example.com/x', headers: { authorization: 'Bearer t' } },
    ])
  })
})
