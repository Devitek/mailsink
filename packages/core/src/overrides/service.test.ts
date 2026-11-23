import { ActivateOverrideRequest } from '@mailsink/contracts'
import { overrides } from '@mailsink/db'
import {
  createTestConnection,
  createTestWorkspaceWithConnection,
  describeDb,
} from '@mailsink/db/testing'
import { asc, eq } from 'drizzle-orm'
import { beforeEach, expect, it } from 'vitest'
import { isDomainError } from '../errors'
import { expireOverrides } from './expiry'
import { activateOverride, getOverrideState, resetOverride } from './service'

describeDb('override service', (ctx) => {
  let seeded: Awaited<ReturnType<typeof createTestWorkspaceWithConnection>>
  const T0 = new Date('2026-11-23T10:00:00Z')
  const plus = (s: number) => new Date(T0.getTime() + s * 1000)
  const req = (input: unknown) => ActivateOverrideRequest.parse(input)

  beforeEach(async () => {
    seeded = await createTestWorkspaceWithConnection(ctx.db)
  })
  const history = () =>
    ctx.db
      .select()
      .from(overrides)
      .where(eq(overrides.workspaceId, seeded.workspace.id))
      .orderBy(asc(overrides.createdAt))

  it('resolves the effective settings per connection with no override', async () => {
    const state = await getOverrideState(ctx.db, seeded.workspace, T0)
    expect(state).toEqual({
      workspace: null,
      connections: [],
      effective: {
        [seeded.connection.id]: {
          rates: { delivered: 100 },
          rules: [],
          latency: { minMs: 0, maxMs: 0 },
          openRate: 0,
          clickRate: 0,
        },
      },
    })
  })

  it('keeps one active override per scope and the history of replaced ones', async () => {
    const other = await createTestConnection(ctx.db, seeded.workspace.id, { name: 'Other' })
    await activateOverride(
      ctx.db,
      seeded.workspace,
      req({ config: { rates: { failed: 10 } } }),
      'api',
      T0,
    )
    await activateOverride(
      ctx.db,
      seeded.workspace,
      req({ connectionId: other.id, config: { latency: { minMs: 5, maxMs: 5 } } }),
      'api',
      plus(1),
    )
    const state = await activateOverride(
      ctx.db,
      seeded.workspace,
      req({ config: { rates: { hard_bounce: 100 } } }),
      'mcp',
      plus(2),
    )
    expect(state.workspace).toMatchObject({
      config: { rates: { hard_bounce: 100 } },
      activatedVia: 'mcp',
    })
    expect(state.connections.map((o) => o.connectionId)).toEqual([other.id])
    expect(state.effective[seeded.connection.id]?.rates).toEqual({ hard_bounce: 100 })
    expect(state.effective[other.id]).toMatchObject({
      rates: { hard_bounce: 100 },
      latency: { minMs: 5, maxMs: 5 },
    })
    const rows = await history()
    expect(rows.map((r) => [r.connectionId, r.resetAt])).toEqual([
      [null, plus(2)],
      [other.id, null],
      [null, null],
    ])
  })

  it('stores the parsed config, chaos codes defaulted', async () => {
    await activateOverride(
      ctx.db,
      seeded.workspace,
      req({ config: { chaos: { errorRate: 50 } } }),
      'api',
      T0,
    )
    const [row] = await history()
    expect(row?.config).toEqual({ chaos: { errorRate: 50, httpCodes: [500], smtpCodes: [451] } })
  })

  it('expires an override after its TTL: ignored at read time, closed by the scheduler', async () => {
    await activateOverride(
      ctx.db,
      seeded.workspace,
      req({ config: { rates: { failed: 1 } }, ttl: '1m' }),
      'api',
      T0,
    )
    expect((await getOverrideState(ctx.db, seeded.workspace, plus(59))).workspace?.expiresAt).toBe(
      plus(60).toISOString(),
    )
    expect((await getOverrideState(ctx.db, seeded.workspace, plus(60))).workspace).toBeNull()
    expect(await expireOverrides(ctx.db, plus(30))).toEqual([])
    const closed = await expireOverrides(ctx.db, plus(61))
    expect(closed.map((o) => o.resetAt)).toEqual([plus(60)])
  })

  it('activates over an expired override not closed yet', async () => {
    await activateOverride(
      ctx.db,
      seeded.workspace,
      req({ config: { rates: { failed: 1 } }, ttl: 1 }),
      'api',
      T0,
    )
    const state = await activateOverride(
      ctx.db,
      seeded.workspace,
      req({ config: { rates: { failed: 2 } } }),
      'api',
      plus(5),
    )
    expect(state.workspace?.config).toEqual({ rates: { failed: 2 } })
  })

  it('resets one scope and stays idempotent', async () => {
    await activateOverride(
      ctx.db,
      seeded.workspace,
      req({ connectionId: seeded.connection.id, config: { rates: { failed: 1 } } }),
      'api',
      T0,
    )
    const state = await resetOverride(ctx.db, seeded.workspace, seeded.connection.id, plus(1))
    expect(state.connections).toEqual([])
    await resetOverride(ctx.db, seeded.workspace, seeded.connection.id, plus(2))
    expect((await history()).map((r) => r.resetAt)).toEqual([plus(1)])
  })

  it('refuses a connection of another workspace', async () => {
    const stranger = await createTestWorkspaceWithConnection(ctx.db)
    const attempt = activateOverride(
      ctx.db,
      seeded.workspace,
      req({ connectionId: stranger.connection.id, config: { rates: { failed: 1 } } }),
      'api',
      T0,
    )
    await expect(attempt).rejects.toSatisfy((e) => isDomainError(e) && e.code === 'not_found')
    await expect(resetOverride(ctx.db, seeded.workspace, stranger.connection.id)).rejects.toSatisfy(
      (e) => isDomainError(e) && e.status === 404,
    )
  })
})
