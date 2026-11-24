import { describe, expect, it } from 'vitest'
import { readBrevoIdempotencyKey } from './idempotency'

describe('readBrevoIdempotencyKey', () => {
  const uuid = 'b2c3d4e5-f6a7-4b2c-9d3e-4f5a6b7c8d9e'

  it('reads idempotencyKey in any case, undefined without it', () => {
    expect(readBrevoIdempotencyKey({ idempotencyKey: uuid })).toBe(uuid)
    expect(readBrevoIdempotencyKey({ IdempotencyKey: ` ${uuid} ` })).toBe(uuid)
    expect(readBrevoIdempotencyKey({ 'X-Mailin-custom': 'x' })).toBeUndefined()
    expect(readBrevoIdempotencyKey(undefined)).toBeUndefined()
  })

  it('refuses a key that is not a UUID with a 400 on its header', () => {
    try {
      readBrevoIdempotencyKey({ idempotencyKey: 'order-42' })
      expect.unreachable()
    } catch (error) {
      expect(error).toMatchObject({
        code: 'validation_error',
        status: 400,
        details: { issues: [{ path: ['headers', 'idempotencyKey'] }] },
      })
    }
  })
})
