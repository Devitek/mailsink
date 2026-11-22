import { ConnectionCredentials } from '@mailsink/contracts'
import { describe, expect, it } from 'vitest'
import { buildCredentials, envSnippet } from './snippets'

const endpoints = {
  publicUrl: 'https://mail.example.com',
  smtpHost: 'mail.example.com',
  smtpPort: 2525,
}

describe('connection credentials and .env snippets', () => {
  it('points Resend at the public base URL', () => {
    const credentials = buildCredentials(
      { kind: 'resend', apiKey: 'msk_0123456789abcdefXYZ' },
      endpoints,
    )
    expect(ConnectionCredentials.parse(credentials)).toEqual(credentials)
    expect(credentials).toEqual({
      kind: 'resend',
      apiKey: 'msk_0123456789abcdefXYZ',
      baseUrl: 'https://mail.example.com',
    })
    expect(envSnippet(credentials)).toBe(
      'RESEND_API_KEY=msk_0123456789abcdefXYZ\nRESEND_BASE_URL=https://mail.example.com\n',
    )
  })

  it('points Brevo at the /v3 base path', () => {
    const credentials = buildCredentials(
      { kind: 'brevo', apiKey: 'msk_0123456789abcdefXYZ' },
      endpoints,
    )
    expect(credentials).toMatchObject({ baseUrl: 'https://mail.example.com/v3' })
    expect(envSnippet(credentials)).toBe(
      'BREVO_API_KEY=msk_0123456789abcdefXYZ\nBREVO_BASE_URL=https://mail.example.com/v3\n',
    )
  })

  it('gives SMTP host, port, user and password', () => {
    const credentials = buildCredentials(
      { kind: 'smtp', smtpUser: 'team-1', smtpPass: 'secret' },
      endpoints,
    )
    expect(ConnectionCredentials.parse(credentials)).toEqual(credentials)
    expect(envSnippet(credentials)).toBe(
      'SMTP_HOST=mail.example.com\nSMTP_PORT=2525\nSMTP_USER=team-1\nSMTP_PASS=secret\n',
    )
  })
})
