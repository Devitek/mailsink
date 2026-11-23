import { ActivateOverrideRequest, type StreamEvent } from '@mailsink/contracts'
import { findActiveOverrides } from '@mailsink/db'
import { createTestConnection, createTestWorkspace, describeDb } from '@mailsink/db/testing'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { installTestRuntime } from '../http/test-fixtures'
import { stopRuntime } from '../runtime/boot'
import type { Runtime } from '../runtime/container'
import { applyOverride, readOverridePanel, resetOverrideScopes } from './override.server'

describeDb('UI override panel', (ctx) => {
  let runtime: Runtime
  beforeAll(async () => {
    runtime = await installTestRuntime(ctx.handle)
  })
  afterAll(() => stopRuntime())

  async function setup() {
    const workspace = await createTestWorkspace(ctx.db, {
      rateLimit: { limit: 5, windowSeconds: 1 },
    })
    const connection = await createTestConnection(ctx.db, workspace.id, { name: 'transac' })
    const frames: StreamEvent[] = []
    runtime.bus.subscribe(workspace.id, (frame) => {
      frames.push(frame.event)
    })
    return { workspace, connection, frames }
  }

  it('reads the state, the connections and the workspace settings', async () => {
    const { workspace, connection } = await setup()
    const panel = await readOverridePanel(runtime, workspace.slug)
    expect(panel).toMatchObject({
      state: { workspace: null, connections: [] },
      connections: [{ id: connection.id, name: 'transac', kind: 'resend' }],
      settings: { rates: { delivered: 100 } },
      rateLimit: { limit: 5, windowSeconds: 1 },
    })
    expect(panel?.state.effective[connection.id]).toBeDefined()
    expect(await readOverridePanel(runtime, workspace.id)).toBeNull()
  })

  it('activates with origin ui, publishes, and resets several scopes', async () => {
    const { workspace, connection, frames } = await setup()
    const request = ActivateOverrideRequest.parse({
      connectionId: connection.id,
      config: { rates: { hard_bounce: 100 } },
      ttl: 900,
    })
    const state = await applyOverride(runtime, workspace.slug, request)
    expect(state.connections).toMatchObject([{ connectionId: connection.id, activatedVia: 'ui' }])
    expect(state.connections[0]?.expiresAt).not.toBeNull()
    await applyOverride(
      runtime,
      workspace.slug,
      ActivateOverrideRequest.parse({ config: { latency: { minMs: 1, maxMs: 2 } } }),
    )
    expect(frames.filter((f) => f.type === 'override.changed')).toHaveLength(2)

    const after = await resetOverrideScopes(runtime, workspace.slug, [null, connection.id])
    expect(after).toMatchObject({ workspace: null, connections: [] })
    expect(await findActiveOverrides(ctx.db, workspace.id, new Date())).toEqual([])
    expect(frames.filter((f) => f.type === 'override.changed')).toHaveLength(4)
  })

  it('refuses an unknown slug or another workspace connection', async () => {
    const { workspace } = await setup()
    const other = await setup()
    const request = ActivateOverrideRequest.parse({
      connectionId: other.connection.id,
      config: { rules: [] },
    })
    await expect(applyOverride(runtime, workspace.slug, request)).rejects.toThrow(/not found/i)
    await expect(resetOverrideScopes(runtime, 'nope-nope', [null])).rejects.toThrow(/not found/i)
  })
})
