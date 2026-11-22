import { describe, expect, it } from 'vitest'
import { health } from './health'

describe('health', () => {
  it('reports ok with whole seconds of uptime when the database answers', async () => {
    expect(await health(async () => {}, { uptimeSeconds: 12.7 })).toEqual({
      httpStatus: 200,
      body: { status: 'ok', uptimeSeconds: 12, checks: { database: 'ok' } },
    })
  })

  it('answers 503 when the database fails', async () => {
    const result = await health(() => Promise.reject(new Error('ECONNREFUSED')))
    expect(result).toMatchObject({
      httpStatus: 503,
      body: { status: 'unavailable', checks: { database: 'error' } },
    })
  })

  it('answers 503 when the database hangs past the timeout', async () => {
    const result = await health(() => new Promise(() => {}), { timeoutMs: 20 })
    expect(result.body.checks.database).toBe('error')
  })
})
