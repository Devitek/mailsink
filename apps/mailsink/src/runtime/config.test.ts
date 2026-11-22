import { describe, expect, it } from 'vitest'
import { readRuntimeConfig } from './config'

describe('readRuntimeConfig', () => {
  it('applies the documented defaults', () => {
    expect(readRuntimeConfig({})).toEqual({
      databaseUrl: 'pglite://./data',
      adminKey: undefined,
      smtpHost: '0.0.0.0',
      smtpPort: 1025,
      workerIntervalMs: 1000,
      retentionIntervalMs: 60_000,
      maxMessageBytes: 26_214_400,
      publicUrl: 'http://localhost:3000',
      defaultIdleTtlSeconds: 3600,
    })
  })

  it('reads the retention interval in seconds', () => {
    expect(
      readRuntimeConfig({ MAILSINK_RETENTION_INTERVAL_SECONDS: '5' }).retentionIntervalMs,
    ).toBe(5000)
    expect(() => readRuntimeConfig({ MAILSINK_RETENTION_INTERVAL_SECONDS: '0' })).toThrow(
      /MAILSINK_RETENTION_INTERVAL_SECONDS/,
    )
  })

  it('reads MAILSINK_MAX_MESSAGE_BYTES and rejects a non-positive value', () => {
    expect(readRuntimeConfig({ MAILSINK_MAX_MESSAGE_BYTES: '1024' }).maxMessageBytes).toBe(1024)
    expect(() => readRuntimeConfig({ MAILSINK_MAX_MESSAGE_BYTES: '0' })).toThrow(
      /MAILSINK_MAX_MESSAGE_BYTES/,
    )
  })

  it('reads every variable, empty values meaning unset', () => {
    const config = readRuntimeConfig({
      DATABASE_URL: 'postgres://u:p@db:5432/mailsink',
      MAILSINK_ADMIN_KEY: 'admin-secret',
      MAILSINK_SMTP_PORT: '2601',
      MAILSINK_SMTP_HOST: '',
    })
    expect(config).toMatchObject({
      databaseUrl: 'postgres://u:p@db:5432/mailsink',
      adminKey: 'admin-secret',
      smtpHost: '0.0.0.0',
      smtpPort: 2601,
    })
  })

  it('reads the public URL and the default idle TTL', () => {
    expect(
      readRuntimeConfig({
        MAILSINK_PUBLIC_URL: 'https://mail.example.com/',
        MAILSINK_DEFAULT_IDLE_TTL: '15m',
      }),
    ).toMatchObject({ publicUrl: 'https://mail.example.com', defaultIdleTtlSeconds: 900 })
    expect(readRuntimeConfig({ MAILSINK_DEFAULT_IDLE_TTL: '120' }).defaultIdleTtlSeconds).toBe(120)
    expect(() => readRuntimeConfig({ MAILSINK_PUBLIC_URL: 'ftp://x' })).toThrow(
      /MAILSINK_PUBLIC_URL/,
    )
    expect(() => readRuntimeConfig({ MAILSINK_DEFAULT_IDLE_TTL: '10' })).toThrow(
      /MAILSINK_DEFAULT_IDLE_TTL/,
    )
  })

  it('rejects an invalid port', () => {
    expect(() => readRuntimeConfig({ MAILSINK_SMTP_PORT: 'abc' })).toThrow(/MAILSINK_SMTP_PORT/)
    expect(() => readRuntimeConfig({ MAILSINK_SMTP_PORT: '70000' })).toThrow(/MAILSINK_SMTP_PORT/)
  })

  it('rejects an invalid DATABASE_URL without echoing it', () => {
    let message = ''
    try {
      readRuntimeConfig({ DATABASE_URL: 'mysql://root:hunter2@db/x' })
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toMatch(/DATABASE_URL/)
    expect(message).not.toContain('hunter2')
  })
})
