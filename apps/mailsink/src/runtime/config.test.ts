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
      smtpPublicHost: undefined,
      smtpPublicPort: undefined,
      jobs: {
        batchSize: 20,
        lockSeconds: 30,
        maxAttempts: 5,
        backoffBaseSeconds: 5,
        backoffMaxSeconds: 900,
        failedRetentionSeconds: 604_800,
      },
    })
  })

  it('reads the job runner settings', () => {
    const config = readRuntimeConfig({
      MAILSINK_JOBS_POLL_INTERVAL_MS: '250',
      MAILSINK_JOBS_BATCH_SIZE: '50',
      MAILSINK_JOBS_LOCK_SECONDS: '120',
      MAILSINK_JOBS_MAX_ATTEMPTS: '8',
      MAILSINK_JOBS_BACKOFF_BASE_SECONDS: '2',
      MAILSINK_JOBS_BACKOFF_MAX_SECONDS: '60',
      MAILSINK_JOBS_FAILED_RETENTION_SECONDS: '3600',
    })
    expect(config.workerIntervalMs).toBe(250)
    expect(config.jobs).toEqual({
      batchSize: 50,
      lockSeconds: 120,
      maxAttempts: 8,
      backoffBaseSeconds: 2,
      backoffMaxSeconds: 60,
      failedRetentionSeconds: 3600,
    })
  })

  it('rejects out-of-range job runner settings', () => {
    for (const [name, value] of [
      ['MAILSINK_JOBS_POLL_INTERVAL_MS', '5'],
      ['MAILSINK_JOBS_BATCH_SIZE', '0'],
      ['MAILSINK_JOBS_LOCK_SECONDS', 'x'],
      ['MAILSINK_JOBS_MAX_ATTEMPTS', '0'],
      ['MAILSINK_JOBS_FAILED_RETENTION_SECONDS', '1.5'],
    ]) {
      expect(() => readRuntimeConfig({ [name as string]: value })).toThrow(name)
    }
    expect(() =>
      readRuntimeConfig({
        MAILSINK_JOBS_BACKOFF_BASE_SECONDS: '60',
        MAILSINK_JOBS_BACKOFF_MAX_SECONDS: '10',
      }),
    ).toThrow(/MAILSINK_JOBS_BACKOFF_MAX_SECONDS/)
  })

  it('reads the public SMTP host and port given to clients', () => {
    expect(
      readRuntimeConfig({
        MAILSINK_SMTP_PUBLIC_HOST: 'smtp.example.com',
        MAILSINK_SMTP_PUBLIC_PORT: '2525',
      }),
    ).toMatchObject({ smtpPublicHost: 'smtp.example.com', smtpPublicPort: 2525 })
    expect(() => readRuntimeConfig({ MAILSINK_SMTP_PUBLIC_PORT: '0' })).toThrow(
      /MAILSINK_SMTP_PUBLIC_PORT/,
    )
    expect(() => readRuntimeConfig({ MAILSINK_SMTP_PUBLIC_HOST: 'a host' })).toThrow(
      /MAILSINK_SMTP_PUBLIC_HOST/,
    )
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
