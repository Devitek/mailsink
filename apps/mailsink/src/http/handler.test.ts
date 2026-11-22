import { issue } from '@mailsink/contracts'
import { DomainError } from '@mailsink/core'
import { describeDb } from '@mailsink/db/testing'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { stopRuntime } from '../runtime/boot'
import type { ApiExtension } from './extensions'
import { defineApi } from './handler'
import { healthz } from './health'
import { installTestRuntime, request, seedWorkspace } from './test-fixtures'

const Body = z
  .object({ name: z.string(), count: z.number().int() })
  .refine((b) => b.count < 10, issue('count_too_high', 'count must be lower than 10', ['count']))

describeDb('defineApi pipeline and errors', (ctx) => {
  let key: string
  beforeAll(async () => {
    await installTestRuntime(ctx.handle)
    key = (await seedWorkspace(ctx.db)).connectionKey
  })
  afterAll(() => stopRuntime())

  const echo = defineApi({
    auth: 'connection',
    params: z.object({ id: z.string().startsWith('msg_') }),
    query: z.object({ tag: z.array(z.string()).optional(), limit: z.coerce.number().default(5) }),
    body: Body,
    handler: ({ params, query, body, auth }) => ({ params, query, body, ws: auth.workspace.slug }),
  })
  const post = (body: string, path = '/probe/msg_1?tag=a&tag=b') =>
    echo({
      request: request(path, { method: 'POST', bearer: key, body }),
      params: { id: 'msg_1' },
    })

  it('parses params, query and body, then answers JSON with X-Request-Id', async () => {
    const res = await post(JSON.stringify({ name: 'x', count: 1 }))
    expect(res.status).toBe(200)
    expect(res.headers.get('x-request-id')).toMatch(/^req_[0-9a-f-]{36}$/)
    expect(await res.json()).toMatchObject({
      params: { id: 'msg_1' },
      query: { tag: ['a', 'b'], limit: 5 },
      body: { name: 'x', count: 1 },
    })
  })

  it('answers 422 validation_error with the Zod issues and their stable code', async () => {
    const res = await post(JSON.stringify({ name: 'x', count: 12 }))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body).toEqual({
      error: {
        code: 'validation_error',
        message: 'Invalid request body',
        details: {
          in: 'body',
          issues: [
            {
              path: ['count'],
              code: 'custom',
              message: 'count must be lower than 10',
              params: { code: 'count_too_high' },
            },
          ],
        },
      },
      requestId: res.headers.get('x-request-id'),
    })
  })

  it('answers 400 on unreadable JSON', async () => {
    const res = await post('{nope')
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('validation_error')
  })

  it('authenticates before parsing: no validation detail leaks to anonymous callers', async () => {
    const res = await echo({ request: request('/probe/x', { method: 'POST', body: '{' }) })
    expect(res.status).toBe(401)
  })

  it('passes DomainError through and hides unexpected errors behind internal_error', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const conflict = defineApi({
      auth: 'none',
      handler: () => {
        throw new DomainError('conflict', 'Already there', { details: { id: 'ws_1' } })
      },
    })
    expect(await (await conflict({ request: request('/c') })).json()).toMatchObject({
      error: { code: 'conflict', message: 'Already there', details: { id: 'ws_1' } },
    })

    const crash = defineApi({
      auth: 'none',
      handler: () => {
        throw new Error('relation "secret_table" does not exist')
      },
    })
    const res = await crash({ request: request('/c') })
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toEqual({ code: 'internal_error', message: 'Internal server error' })
    expect(JSON.stringify(body)).not.toContain('secret_table')
    expect(log).toHaveBeenCalledWith(expect.stringContaining(body.requestId), expect.any(Error))
    log.mockRestore()
  })

  it('runs extensions after auth and on every response', async () => {
    const seen: string[] = []
    const limiter: ApiExtension = {
      name: 'test-limiter',
      afterAuth: ({ auth }) => {
        seen.push(`auth:${auth ? 'yes' : 'no'}`)
        throw new DomainError('rate_limited', 'Too many requests', {
          headers: { 'Retry-After': '1' },
        })
      },
      onResponse: (_ctx, response, error) => {
        seen.push(`response:${response.status}:${(error as DomainError).code}`)
        response.headers.set('X-RateLimit-Remaining', '0')
      },
    }
    const limited = defineApi({ auth: 'connection', extensions: [limiter], handler: () => 'never' })
    const res = await limited({ request: request('/l', { bearer: key }) })
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('1')
    expect(res.headers.get('x-ratelimit-remaining')).toBe('0')
    expect(seen).toEqual(['auth:yes', 'response:429:rate_limited'])
  })

  it('serves /healthz with the database readiness', async () => {
    const res = await healthz({ request: request('/healthz') })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'ok', checks: { database: 'ok' } })
  })
})
