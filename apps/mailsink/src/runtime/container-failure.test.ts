import { describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from './config'
import { createRuntime } from './container'

const closed = vi.hoisted(() => ({ smtp: 0, worker: 0 }))

vi.mock('@mailsink/smtp', async (original) => {
  const actual = await original<typeof import('@mailsink/smtp')>()
  return {
    ...actual,
    startSmtpServer: async (...args: Parameters<typeof actual.startSmtpServer>) => {
      const server = await actual.startSmtpServer(...args)
      return {
        ...server,
        close: async () => {
          closed.smtp += 1
          await server.close()
        },
      }
    },
  }
})

vi.mock('@mailsink/core', async (original) => {
  const actual = await original<typeof import('@mailsink/core')>()
  return {
    ...actual,
    startWorker: (...args: Parameters<typeof actual.startWorker>) => {
      const worker = actual.startWorker(...args)
      return {
        ...worker,
        stop: async () => {
          closed.worker += 1
          await worker.stop()
        },
      }
    },
    startRetentionScheduler: () => {
      throw new Error('retention scheduler failed')
    },
  }
})

const silent = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

const config: RuntimeConfig = {
  databaseUrl: 'pglite://memory',
  adminKey: 'admin',
  smtpHost: '127.0.0.1',
  smtpPort: 0,
  workerIntervalMs: 10,
  retentionIntervalMs: 3_600_000,
  maxMessageBytes: 26_214_400,
  publicUrl: 'http://localhost:3000',
  defaultIdleTtlSeconds: 3600,
}

describe('createRuntime failure after the SMTP listener started', () => {
  it('closes the SMTP server and the services already started', async () => {
    await expect(createRuntime(config, silent)).rejects.toThrow('retention scheduler failed')
    expect(closed).toEqual({ smtp: 1, worker: 1 })
  }, 30_000)
})
