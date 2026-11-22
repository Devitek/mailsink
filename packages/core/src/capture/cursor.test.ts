import { describe, expect, it } from 'vitest'
import { DomainError } from '../errors'
import { decodeCursor, encodeCursor } from './cursor'

const cursor = { createdAt: '2026-11-22T10:00:00.123456Z', id: 'msg_0193-abc' }

describe('message cursor', () => {
  it('round-trips an opaque, URL-safe value', () => {
    const encoded = encodeCursor(cursor)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodeCursor(encoded)).toEqual(cursor)
  })

  it.each([
    'not base64 json',
    Buffer.from('{"a":1}').toString('base64url'),
    Buffer.from('["2026-11-22", "msg_1"]').toString('base64url'),
    Buffer.from('["2026-11-22T10:00:00.123456Z", "con_1"]').toString('base64url'),
  ])('rejects %s with a 422 invalid_cursor', (value) => {
    let error: unknown
    try {
      decodeCursor(value)
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(DomainError)
    expect(error).toMatchObject({
      code: 'validation_error',
      status: 422,
      details: { in: 'query', issues: [{ path: ['cursor'], params: { code: 'invalid_cursor' } }] },
    })
  })
})
