import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { errorResponses, errorStatuses } from './errors'
import type { RouteSpec } from './route'

const base: RouteSpec = {
  operationId: 'x',
  method: 'get',
  path: '/x',
  tag: 'Admin',
  summary: 'x',
  auth: 'admin',
  success: [{ status: 200, description: 'ok' }],
}
const params = z.object({ id: z.string() })

const statuses = (route: Partial<RouteSpec>) => [...errorStatuses({ ...base, ...route }).keys()]

describe('errorStatuses (D40)', () => {
  it('derives auth, input and internal errors of an admin read', () => {
    expect(statuses({ params })).toEqual([401, 403, 404, 422, 500])
    expect(errorStatuses({ ...base, params }).get(404)).toEqual(['not_found'])
  })

  it('a public route without input only fails internally', () => {
    expect(statuses({ auth: 'none' })).toEqual([500])
  })

  it('a JSON body adds the unreadable body 400 and the 413 cap', () => {
    expect(statuses({ method: 'post', body: z.object({}) })).toEqual([400, 401, 403, 413, 422, 500])
  })

  it('workspace scope adds the missing X-Mailsink-Workspace 400', () => {
    expect(statuses({ auth: 'workspace' })).toEqual([400, 401, 403, 500])
  })

  it('ingestion adds idempotency, rate limit and chaos statuses', () => {
    const map = errorStatuses({
      ...base,
      method: 'post',
      auth: 'connection',
      body: z.object({}),
      ingestion: true,
    })
    expect([...map.keys()]).toEqual([400, 401, 403, 409, 413, 422, 429, 500, 502, 503])
    expect(map.get(429)).toEqual(['rate_limited', 'chaos_injected'])
    expect(map.get(503)).toEqual(['chaos_injected'])
  })

  it('Brevo answers every validation error with 400', () => {
    const map = errorStatuses({
      ...base,
      method: 'post',
      auth: 'brevo',
      errorDialect: 'brevo',
      body: z.object({}),
    })
    expect(map.has(422)).toBe(false)
    expect(map.get(400)).toEqual(['validation_error'])
  })

  it('Resend answers an invalid key on a read with 400', () => {
    const map = errorStatuses({ ...base, auth: 'connection', errorDialect: 'resend', params })
    expect(map.get(400)).toEqual(['unauthorized'])
  })

  it('explicit codes are added with their D40 status', () => {
    expect(statuses({ method: 'post', errors: ['conflict', 'wait_timeout'] })).toEqual([
      401, 403, 408, 409, 500,
    ])
  })
})

describe('errorResponses', () => {
  it('uses the dialect body and the status specific headers', () => {
    const responses = errorResponses({
      ...base,
      auth: 'connection',
      errorDialect: 'resend',
      ingestion: true,
    })
    const headerNames = (status: string) =>
      Object.keys((responses[status]?.headers as z.ZodObject | undefined)?.shape ?? {})
    expect(responses['429']?.description).toContain('`rate_limited`')
    expect(headerNames('429')).toContain('Retry-After')
    expect(headerNames('429')).toContain('ratelimit-limit')
    expect(headerNames('401')).toContain('WWW-Authenticate')
  })
})
