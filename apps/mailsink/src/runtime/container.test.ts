import { enqueueJobs, jobs, messageRecipients, messages, newId, workspaces } from '@mailsink/db'
import { openTestDb, testDatabaseUrl } from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
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
    const workspaceId = newId('ws')
    const messageId = newId('msg')
    await db.transaction(async (tx) => {
      await tx
        .insert(workspaces)
        .values({ id: workspaceId, slug: workspaceId, name: 'W', createdVia: 'admin_api' })
      await tx.insert(messages).values({
        id: messageId,
        workspaceId,
        source: 'native',
        providerMessageId: messageId,
        from: { email: 'app@example.com' },
        sizeBytes: 1,
      })
      await tx.insert(messageRecipients).values({
        id: newId('rcp'),
        messageId,
        workspaceId,
        kind: 'to',
        email: 'a@example.com',
      })
      await enqueueJobs(tx, [{ kind: 'simulate_delivery', workspaceId, payload: { messageId } }])
    })

    const status = async () =>
      (await db.select({ s: messages.status }).from(messages).where(eq(messages.id, messageId)))[0]
        ?.s
    await expect.poll(status, { timeout: 5_000 }).toBe('delivered')
    expect(await db.select().from(jobs)).toEqual([])
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
