import { hashSmtpPassword } from '@mailsink/core'
import { enqueueJobs, insertOverride, jobs, messages, newId } from '@mailsink/db'
import {
  createTestConnection,
  createTestMessage,
  createTestRecipients,
  createTestWorkspace,
  openTestDb,
  testDatabaseUrl,
} from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { createTransport } from 'nodemailer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RuntimeConfig } from './config'
import { createRuntime, type Runtime } from './container'

const silent = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

const baseConfig: RuntimeConfig = {
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

describe('createRuntime background processing', () => {
  let runtime: Runtime | undefined

  afterEach(async () => {
    await runtime?.stop()
    runtime = undefined
  })

  it('runs the simulate_delivery jobs of queued messages', async () => {
    runtime = await createRuntime(baseConfig, silent)
    const { db } = runtime.db
    const messageId = await db.transaction(async (tx) => {
      const workspace = await createTestWorkspace(tx)
      const message = await createTestMessage(tx, workspace.id)
      await createTestRecipients(tx, message, [{ email: 'a@example.com' }])
      await enqueueJobs(tx, [
        {
          kind: 'simulate_delivery',
          workspaceId: workspace.id,
          payload: { messageId: message.id },
        },
      ])
      return message.id
    })

    const status = async () =>
      (await db.select({ s: messages.status }).from(messages).where(eq(messages.id, messageId)))[0]
        ?.s
    await expect.poll(status, { timeout: 5_000 }).toBe('delivered')
    expect(await db.select().from(jobs)).toEqual([])
  }, 30_000)
})

describe('createRuntime SMTP wiring', () => {
  let runtime: Runtime | undefined

  afterEach(async () => {
    await runtime?.stop()
    runtime = undefined
  })

  it('ingests SMTP mail through the pipeline, with the runtime chaos source', async () => {
    runtime = await createRuntime(baseConfig, silent)
    const { db } = runtime.db
    const workspace = await createTestWorkspace(db)
    await createTestConnection(db, workspace.id, {
      kind: 'smtp',
      smtpUsername: 'smtp-user',
      smtpPasswordHash: await hashSmtpPassword('smtp-pass'),
    })
    const transport = createTransport({
      host: '127.0.0.1',
      port: runtime.smtpPort,
      ignoreTLS: true,
      auth: { user: 'smtp-user', pass: 'smtp-pass' },
    })
    const mail = { from: 'a@example.test', to: 'b@example.test', subject: 's', text: 'x' }
    try {
      const info = await transport.sendMail(mail)
      const id = info.response.split(' ').at(-1) ?? ''
      const status = async () =>
        (await db.select({ s: messages.status }).from(messages).where(eq(messages.id, id)))[0]?.s
      await expect.poll(status, { timeout: 5_000 }).toBe('delivered')

      await insertOverride(db, {
        id: newId('ovr'),
        workspaceId: workspace.id,
        connectionId: null,
        config: { chaos: { errorRate: 50, httpCodes: [500], smtpCodes: [550] } },
        activatedVia: 'api',
        expiresAt: null,
        createdAt: new Date(Date.now() - 1_000),
      })
      runtime.chaosRandom = () => 0
      await expect(transport.sendMail(mail)).rejects.toMatchObject({ responseCode: 550 })
    } finally {
      transport.close()
    }
  }, 30_000)
})

describe.skipIf(!testDatabaseUrl())('createRuntime on Postgres', () => {
  it('leaves a single pool error listener, routed to the runtime logger', async () => {
    const database = await openTestDb('postgres', { migrate: false })
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    const runtime = await createRuntime({ ...baseConfig, databaseUrl: database.url }, log)
    try {
      const pool = runtime.db.client as unknown as NodeJS.EventEmitter
      expect(pool.listenerCount('error')).toBe(1)
      pool.emit('error', new Error('terminated'))
      expect(log.warn).toHaveBeenCalledTimes(1)
      expect(log.warn).toHaveBeenCalledWith('[mailsink] database connection lost: terminated')
    } finally {
      await runtime.stop()
      await database.dispose()
    }
  }, 30_000)
})
