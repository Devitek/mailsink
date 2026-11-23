import { createRateLimiter } from '@mailsink/core'
import { connections, messages, workspaces } from '@mailsink/db'
import { describeDb } from '@mailsink/db/testing'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { stopRuntime } from '../runtime/boot'
import { postWorkspace } from './admin/workspaces'
import { listMessages } from './capture/api'
import { postOverride, postOverrideReset } from './capture/override'
import { postEmail, postEmailBatch } from './native/emails'
import { ADMIN_KEY, installTestRuntime, request } from './test-fixtures'

const email = { from: 'app@example.com', to: 'jane@x.io', subject: 'Hi', text: 'Hello' }

describeDb('ingestion guard: rate limit and chaos', (ctx) => {
  let clock = 0
  let draws: number[] = []
  let workspaceKey: string
  let connectionKey: string
  let connectionId: string
  let workspaceId: string

  const json = (bearer: string, body: unknown) => ({
    method: 'POST',
    bearer,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const send = (route = postEmail) =>
    route({ request: request('/v1/emails', json(connectionKey, email)) })
  const override = (body: unknown) =>
    postOverride({ request: request('/capture/override', json(workspaceKey, body)) })
  const stored = async () =>
    (await ctx.db.select().from(messages).where(eq(messages.workspaceId, workspaceId))).length

  beforeAll(async () => {
    await installTestRuntime(
      ctx.handle,
      {},
      {
        rateLimiter: createRateLimiter({ now: () => clock }),
        chaosRandom: () => draws.shift() ?? 0.999,
      },
    )
    // Workspace layer written through the Admin API: the parsed contract output is stored.
    const res = await postWorkspace({
      request: request(
        '/admin/workspaces',
        json(ADMIN_KEY, {
          name: 'Guarded',
          rateLimit: { limit: 3 },
          connections: [{ kind: 'resend', name: 'app' }],
        }),
      ),
    })
    const created = await res.json()
    workspaceKey = created.workspaceKey
    connectionKey = created.connections[0].credentials.apiKey
    connectionId = created.connections[0].id
    workspaceId = created.workspace.id
  })
  afterAll(() => stopRuntime())
  beforeEach(async () => {
    clock += 3_600_000 // every bucket full again
    draws = []
    await postOverrideReset({ request: request('/capture/override/reset', json(workspaceKey, {})) })
    await postOverrideReset({
      request: request('/capture/override/reset', json(workspaceKey, { connectionId })),
    })
  })

  it('stores rate_limit as the parsed contract output (windowSeconds defaulted)', async () => {
    const [ws] = await ctx.db.select().from(workspaces).where(eq(workspaces.id, workspaceId))
    expect(ws?.rateLimit).toEqual({ limit: 3, windowSeconds: 1 })
    const [con] = await ctx.db.select().from(connections).where(eq(connections.id, connectionId))
    expect(con?.rateLimit).toBeNull()
  })

  it('applies the workspace layer with X-RateLimit-* headers on every response', async () => {
    const before = await stored()
    const statuses = []
    for (let i = 0; i < 4; i++) statuses.push(await send())
    expect(statuses.map((r) => r.status)).toEqual([200, 200, 200, 429])
    expect(statuses.map((r) => r.headers.get('x-ratelimit-remaining'))).toEqual([
      '2',
      '1',
      '0',
      '0',
    ])
    const denied = statuses[3] as Response
    expect(Object.fromEntries(denied.headers)).toMatchObject({
      'x-ratelimit-limit': '3',
      'x-ratelimit-reset': '1',
      'retry-after': '1',
    })
    expect((await denied.json()).error).toEqual({
      code: 'rate_limited',
      message: 'Rate limit exceeded, retry in 1s',
    })
    expect(statuses[0]?.headers.get('retry-after')).toBeNull()
    expect((await stored()) - before).toBe(3)
    clock += 334
    expect((await send()).status).toBe(200)
  })

  it('lets the active override win over the settings, connection scope first', async () => {
    await override({ config: { rateLimit: { limit: 10 } } })
    await override({ connectionId, config: { rateLimit: { limit: 2, windowSeconds: 60 } } })
    const results = [await send(), await send(postEmailBatch), await send()]
    expect(results.map((r) => r.status)).toEqual([200, 422, 429])
    expect(results[2]?.headers.get('retry-after')).toBe('30')
    expect(results[2]?.headers.get('x-ratelimit-limit')).toBe('2')
  })

  it('injects the configured chaos code and stores nothing', async () => {
    await override({ config: { chaos: { errorRate: 100, httpCodes: [503] } } })
    const before = await stored()
    const res = await send()
    expect(res.status).toBe(503)
    expect((await res.json()).error).toEqual({
      code: 'chaos_injected',
      message: 'Simulated failure (chaos 503)',
    })
    expect(res.headers.get('x-ratelimit-remaining')).toBe('2')
    expect(await stored()).toBe(before)
  })

  it('draws chaos deterministically from the injected random', async () => {
    await override({ config: { chaos: { errorRate: 50, httpCodes: [429, 502] } } })
    draws = [0.5, 0.49, 0.6]
    const res = [await send(), await send()]
    expect(res.map((r) => r.status)).toEqual([200, 502])
  })

  it('leaves Capture and Admin untouched by chaos and the rate limit', async () => {
    await override({
      config: { chaos: { errorRate: 100, httpCodes: [500] }, rateLimit: { limit: 1 } },
    })
    for (let i = 0; i < 3; i++) {
      const res = await listMessages({
        request: request('/capture/messages', { bearer: workspaceKey }),
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('x-ratelimit-limit')).toBeNull()
    }
  })
})
