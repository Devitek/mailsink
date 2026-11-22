import { enqueueJobs, jobs, messageRecipients, messages, newId, workspaces } from '@mailsink/db'
import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRuntime, type Runtime } from './container'

const silent = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

describe('createRuntime background processing', () => {
  let runtime: Runtime | undefined

  afterEach(async () => {
    await runtime?.stop()
    runtime = undefined
  })

  it('runs the simulate_delivery jobs of queued messages', async () => {
    runtime = await createRuntime(
      {
        databaseUrl: 'pglite://memory',
        adminKey: 'admin',
        smtpHost: '127.0.0.1',
        smtpPort: 0,
        workerIntervalMs: 10,
        retentionIntervalMs: 3_600_000,
      },
      silent,
    )
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
