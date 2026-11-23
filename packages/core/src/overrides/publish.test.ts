import { ActivateOverrideRequest } from '@mailsink/contracts'
import { createTestWorkspaceWithConnection, describeDb } from '@mailsink/db/testing'
import { beforeEach, expect, it } from 'vitest'
import { createEventBus, type EventBus, type StreamFrame } from '../events/bus'
import { expireOverrides } from './expiry'
import { overrideChangedFrame, publishExpiredOverrides } from './publish'
import { activateOverride } from './service'

describeDb('override.changed publication', (ctx) => {
  let seeded: Awaited<ReturnType<typeof createTestWorkspaceWithConnection>>
  let bus: EventBus
  let seen: StreamFrame[]
  const T0 = new Date('2026-11-23T10:00:00Z')
  const plus = (s: number) => new Date(T0.getTime() + s * 1000)
  const activate = (input: unknown, workspace = seeded.workspace) =>
    activateOverride(ctx.db, workspace, ActivateOverrideRequest.parse(input), 'api', T0)

  beforeEach(async () => {
    seeded = await createTestWorkspaceWithConnection(ctx.db)
    bus = createEventBus()
    seen = []
    bus.subscribe(seeded.workspace.id, (f) => seen.push(f))
  })

  it('builds a derived frame (no SSE id) carrying the state', async () => {
    const state = await activate({ config: { rates: { failed: 100 } } })
    expect(overrideChangedFrame(state, seeded.connection.id)).toEqual({
      id: null,
      connectionId: seeded.connection.id,
      event: { type: 'override.changed', state },
    })
  })

  it('publishes the state after expiry, once per workspace', async () => {
    await activate({ config: { rates: { failed: 100 } }, ttl: 60 })
    await activate({
      connectionId: seeded.connection.id,
      config: { rates: { failed: 1 } },
      ttl: 60,
    })
    const closed = await expireOverrides(ctx.db, plus(61))
    expect(closed).toHaveLength(2)
    await publishExpiredOverrides(ctx.db, bus, closed, plus(61))
    expect(seen).toHaveLength(1)
    expect(seen[0]?.event).toMatchObject({
      type: 'override.changed',
      state: { workspace: null, connections: [] },
    })
  })

  it('skips workspaces nobody listens to, and deleted ones', async () => {
    const other = await createTestWorkspaceWithConnection(ctx.db)
    await activate({ config: { rates: { failed: 100 } }, ttl: 60 }, other.workspace)
    const closed = await expireOverrides(ctx.db, plus(61))
    await publishExpiredOverrides(ctx.db, bus, closed, plus(61))
    bus.subscribe('ws_gone', (f) => seen.push(f))
    await publishExpiredOverrides(ctx.db, bus, [{ ...closed[0], workspaceId: 'ws_gone' } as never])
    expect(seen).toEqual([])
  })
})
