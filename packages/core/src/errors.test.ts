import { describe, expect, it } from 'vitest'
import { hashApiKey, secretsEqual } from './crypto'
import { DomainError, isDomainError } from './errors'

describe('DomainError', () => {
  it('maps the code to its default status', () => {
    const error = new DomainError('not_found', 'Workspace not found')
    expect(error).toMatchObject({ code: 'not_found', status: 404, message: 'Workspace not found' })
    expect(isDomainError(error)).toBe(true)
    expect(isDomainError(new Error('boom'))).toBe(false)
  })

  it('accepts a status override, details and headers', () => {
    const error = new DomainError('rate_limited', 'Slow down', {
      status: 429,
      details: { limit: 10 },
      headers: { 'Retry-After': '3' },
    })
    expect(error).toMatchObject({ details: { limit: 10 }, headers: { 'Retry-After': '3' } })
  })
})

describe('crypto', () => {
  it('hashes api keys as SHA-256 hex', () => {
    expect(hashApiKey('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('compares secrets of different lengths without throwing', () => {
    expect(secretsEqual('admin-key', 'admin-key')).toBe(true)
    expect(secretsEqual('admin-key', 'admin')).toBe(false)
  })
})
