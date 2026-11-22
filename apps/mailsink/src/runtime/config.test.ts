import { describe, expect, it } from 'vitest'
import { readRuntimeConfig } from './config'

describe('readRuntimeConfig', () => {
  it('defaults the SMTP listener to 0.0.0.0:1025', () => {
    expect(readRuntimeConfig({})).toEqual({
      smtpHost: '0.0.0.0',
      smtpPort: 1025,
      workerIntervalMs: 1000,
    })
  })

  it('reads MAILSINK_SMTP_PORT and MAILSINK_SMTP_HOST', () => {
    const config = readRuntimeConfig({ MAILSINK_SMTP_PORT: '2601', MAILSINK_SMTP_HOST: '::1' })
    expect(config.smtpPort).toBe(2601)
    expect(config.smtpHost).toBe('::1')
  })

  it('rejects an invalid port', () => {
    expect(() => readRuntimeConfig({ MAILSINK_SMTP_PORT: 'abc' })).toThrow(/MAILSINK_SMTP_PORT/)
    expect(() => readRuntimeConfig({ MAILSINK_SMTP_PORT: '70000' })).toThrow(/MAILSINK_SMTP_PORT/)
  })
})
