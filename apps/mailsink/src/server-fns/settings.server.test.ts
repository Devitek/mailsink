import { CreateWorkspaceRequest, UpdateWorkspaceRequest } from '@mailsink/contracts'
import { createTestMessage, describeDb } from '@mailsink/db/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { installTestRuntime } from '../http/test-fixtures'
import { stopRuntime } from '../runtime/boot'
import type { Runtime } from '../runtime/container'
import { readSettingsPage, saveWorkspaceDefaults } from './settings.server'
import { eventCatalog } from './settings-catalog'
import { createWorkspaceFromUi } from './workspaces-manage.server'

describe('eventCatalog', () => {
  it('lists dialect names with the canonical events they stand for', () => {
    const catalog = eventCatalog()
    expect(catalog.unified.map((c) => c.name)).toContain('email.suppressed')
    expect(catalog.resend.find((c) => c.name === 'email.delivery_delayed')?.events).toEqual([
      'email.deferred',
      'email.soft_bounced',
    ])
    expect(catalog.resend.some((c) => c.events.includes('email.suppressed'))).toBe(false)
    expect(catalog.brevo.find((c) => c.name === 'hardBounce')?.events).toEqual([
      'email.hard_bounced',
    ])
    expect(catalog.brevo.find((c) => c.name === 'invalid')?.events).toEqual(['email.failed'])
  })
})

describeDb('UI workspace settings', (ctx) => {
  let runtime: Runtime
  beforeAll(async () => {
    runtime = await installTestRuntime(ctx.handle, { publicUrl: 'https://mail.test' })
  })
  afterAll(() => stopRuntime())

  it('reads the defaults, connections and message count of a workspace by slug', async () => {
    const created = await createWorkspaceFromUi(
      runtime,
      CreateWorkspaceRequest.parse({
        name: 'Settings',
        slug: 'settings-ui',
        connections: [{ kind: 'brevo', name: 'brevo-main' }],
      }),
    )
    if (!created.ok) throw new Error('expected a workspace')
    const page = await readSettingsPage(runtime, 'settings-ui')
    if (!page) throw new Error('expected the page')
    await createTestMessage(ctx.db, page.workspace.id)
    const again = await readSettingsPage(runtime, 'settings-ui')
    expect(again?.workspace).toMatchObject({
      slug: 'settings-ui',
      maxMessages: null,
      messageCount: 1,
      publicUrl: 'https://mail.test',
      mcpUrl: 'https://mail.test/mcp',
      simulation: { rates: { delivered: 100 }, openRate: 0 },
    })
    expect(again?.connections).toEqual([
      { id: expect.any(String), name: 'brevo-main', kind: 'brevo', disabled: false },
    ])
    expect(await readSettingsPage(runtime, page.workspace.id)).toBeNull()
  })

  it('saves the quota, rate limit and default simulation', async () => {
    await createWorkspaceFromUi(
      runtime,
      CreateWorkspaceRequest.parse({ name: 'Defaults', slug: 'defaults-ui' }),
    )
    const patch = UpdateWorkspaceRequest.parse({
      retention: 3600,
      maxMessages: 200,
      rateLimit: { limit: 20, windowSeconds: 1, burst: 40 },
      simulation: { rates: { hard_bounce: 3 }, latency: { minMs: 50, maxMs: 500 }, openRate: 30 },
    })
    await saveWorkspaceDefaults(runtime, 'defaults-ui', patch)
    const page = await readSettingsPage(runtime, 'defaults-ui')
    expect(page?.workspace).toMatchObject({
      retentionSeconds: 3600,
      maxMessages: 200,
      rateLimit: { limit: 20, windowSeconds: 1, burst: 40 },
      simulation: { rates: { hard_bounce: 3 }, latency: { minMs: 50, maxMs: 500 }, openRate: 30 },
    })
    await expect(saveWorkspaceDefaults(runtime, 'nope-ui', patch)).rejects.toMatchObject({
      code: 'not_found',
    })
  })
})
