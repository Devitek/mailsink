import { overrides } from '@mailsink/db'
import { describeDb } from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { stopRuntime } from '../../runtime/boot'
import { installTestRuntime, request, seedWorkspace } from '../test-fixtures'
import { getOverride, postOverride, postOverrideReset } from './override'

describeDb('Override API over HTTP', (ctx) => {
  let a: Awaited<ReturnType<typeof seedWorkspace>>
  let b: Awaited<ReturnType<typeof seedWorkspace>>
  beforeAll(async () => {
    await installTestRuntime(ctx.handle)
    a = await seedWorkspace(ctx.db)
    b = await seedWorkspace(ctx.db)
  })
  afterAll(() => stopRuntime())

  const post = (route: typeof postOverride, path: string, body: unknown, bearer = a.workspaceKey) =>
    route({
      request: request(path, {
        method: 'POST',
        bearer,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    })
  const read = async (bearer = a.workspaceKey) =>
    getOverride({ request: request('/capture/override', { bearer }) })

  it('reads the state with no override', async () => {
    const res = await read()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      workspace: null,
      connections: [],
      effective: { [a.connection.id]: { rates: { delivered: 100 } } },
    })
    expect((await getOverride({ request: request('/capture/override') })).status).toBe(401)
  })

  it('activates, replaces and resets an override with a TTL', async () => {
    const res = await post(postOverride, '/capture/override', {
      config: { rates: { hard_bounce: 100 }, chaos: { errorRate: 5 } },
      ttl: '1h',
    })
    expect(res.status).toBe(200)
    const state = await res.json()
    expect(state.workspace).toMatchObject({
      connectionId: null,
      activatedVia: 'api',
      config: { chaos: { errorRate: 5, httpCodes: [500], smtpCodes: [451] } },
    })
    expect(Date.parse(state.workspace.expiresAt) - Date.parse(state.workspace.createdAt)).toBe(
      3_600_000,
    )
    expect(state.effective[a.connection.id].rates).toEqual({ hard_bounce: 100 })

    const scoped = await post(postOverride, '/capture/override', {
      connectionId: a.connection.id,
      config: { latency: { minMs: 10, maxMs: 20 } },
    })
    expect((await scoped.json()).connections).toHaveLength(1)

    const reset = await post(postOverrideReset, '/capture/override/reset', {})
    const after = await reset.json()
    expect(after.workspace).toBeNull()
    expect(after.connections).toHaveLength(1)
    const rows = await ctx.db
      .select()
      .from(overrides)
      .where(eq(overrides.workspaceId, a.workspace.id))
    expect(rows).toHaveLength(2)
    // Another workspace sees none of it.
    expect((await (await read(b.workspaceKey)).json()).connections).toEqual([])
  })

  it('validates the config and the connection scope', async () => {
    const empty = await post(postOverride, '/capture/override', { config: {} })
    expect(empty.status).toBe(422)
    expect((await empty.json()).error.details.issues[0]).toMatchObject({
      params: { code: 'override_empty' },
    })
    const sum = await post(postOverride, '/capture/override', {
      config: { rates: { failed: 60, hard_bounce: 60 } },
    })
    expect(sum.status).toBe(422)
    const foreign = await post(postOverride, '/capture/override', {
      connectionId: b.connection.id,
      config: { rates: { failed: 1 } },
    })
    expect(foreign.status).toBe(404)
    const resetForeign = await post(postOverrideReset, '/capture/override/reset', {
      connectionId: b.connection.id,
    })
    expect(resetForeign.status).toBe(404)
  })
})
