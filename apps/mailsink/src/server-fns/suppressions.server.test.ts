import { createTestSuppression, createTestWorkspace, describeDb } from '@mailsink/db/testing'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { installTestRuntime } from '../http/test-fixtures'
import { stopRuntime } from '../runtime/boot'
import type { Runtime } from '../runtime/container'
import { readSuppressionsPage, removeSuppressions } from './suppressions.server'

describeDb('UI suppression list', (ctx) => {
  let runtime: Runtime
  beforeAll(async () => {
    runtime = await installTestRuntime(ctx.handle)
  })
  afterAll(() => stopRuntime())

  async function seeded(count: number) {
    const workspace = await createTestWorkspace(ctx.db)
    for (let i = 0; i < count; i++) {
      await createTestSuppression(ctx.db, workspace.id, `user${i}@bounce.test`)
    }
    await createTestSuppression(ctx.db, workspace.id, 'Angry@Complaints.test', 'complained')
    return workspace
  }

  it('pages newest first with a cursor and filters by email', async () => {
    const workspace = await seeded(3)
    const first = await readSuppressionsPage(runtime, workspace.slug, { limit: 2 })
    expect(first.data.map((s) => s.email)).toEqual(['Angry@Complaints.test', 'user2@bounce.test'])
    expect(first.nextCursor).not.toBeNull()
    const second = await readSuppressionsPage(runtime, workspace.slug, {
      limit: 2,
      cursor: first.nextCursor ?? undefined,
    })
    expect(second.data.map((s) => s.email)).toEqual(['user1@bounce.test', 'user0@bounce.test'])
    expect(second.nextCursor).toBeNull()

    const filtered = await readSuppressionsPage(runtime, workspace.slug, { email: 'complaints' })
    expect(filtered.data).toMatchObject([{ email: 'Angry@Complaints.test', reason: 'complained' }])
  })

  it('removes one address, then the whole list', async () => {
    const workspace = await seeded(2)
    expect(await removeSuppressions(runtime, workspace.slug, 'user0@bounce.test')).toEqual({
      count: 1,
    })
    expect(await removeSuppressions(runtime, workspace.slug)).toEqual({ count: 2 })
    expect((await readSuppressionsPage(runtime, workspace.slug, {})).data).toEqual([])
  })

  it('refuses an unknown slug', async () => {
    await expect(readSuppressionsPage(runtime, 'nope-nope', {})).rejects.toThrow(/not found/i)
  })
})
