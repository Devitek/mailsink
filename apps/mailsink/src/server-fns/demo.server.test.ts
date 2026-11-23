import { messages } from '@mailsink/db'
import { createTestWorkspace, describeDb } from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { installTestRuntime } from '../http/test-fixtures'
import { stopRuntime } from '../runtime/boot'
import type { Runtime } from '../runtime/container'
import { loadDemoMessages } from './demo.server'
import { readMessageOrigin } from './message-origin.server'

describeDb('UI demo messages', (ctx) => {
  let runtime: Runtime
  beforeAll(async () => {
    runtime = await installTestRuntime(ctx.handle)
  })
  afterAll(() => stopRuntime())

  it('seeds the workspace of the slug in the locale given, without a connection', async () => {
    const workspace = await createTestWorkspace(ctx.db)
    const seeded = await loadDemoMessages(runtime, workspace.slug, 'en')
    expect(seeded.count).toBe(8)
    const rows = await ctx.db.select().from(messages).where(eq(messages.workspaceId, workspace.id))
    expect(rows).toHaveLength(8)
    expect(rows.every((m) => m.source === 'native' && m.connectionId === null)).toBe(true)
    expect(rows.map((m) => m.subject)).toContain('Your invoice INV-2026-0142')
    // « See in the logs » of the viewer: each demo message has its request log (#118).
    const [first] = seeded.messageIds
    const origin = await readMessageOrigin(runtime, workspace.slug, first ?? '')
    expect(origin).toMatchObject({ kind: 'api', method: 'POST', path: '/v1/emails' })
  })

  it('refuses an unknown slug', async () => {
    await expect(loadDemoMessages(runtime, 'nope-nope', 'en')).rejects.toThrow(/not found/i)
  })
})
