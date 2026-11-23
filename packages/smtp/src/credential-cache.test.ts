import { describe, expect, it } from 'vitest'
import { createCredentialCache } from './credential-cache'

describe('createCredentialCache', () => {
  it('knows a remembered password for the same stored hash only', () => {
    const cache = createCredentialCache()
    cache.remember('con_1', 'hash-a', 'secret')
    expect(cache.has('con_1', 'hash-a', 'secret')).toBe(true)
    expect(cache.has('con_1', 'hash-a', 'wrong')).toBe(false)
    expect(cache.has('con_1', 'hash-b', 'secret')).toBe(false)
    expect(cache.has('con_2', 'hash-a', 'secret')).toBe(false)
  })

  it('drops the oldest entry above its size', () => {
    const cache = createCredentialCache(2)
    cache.remember('con_1', 'h', 'p')
    cache.remember('con_2', 'h', 'p')
    cache.remember('con_3', 'h', 'p')
    expect(cache.size).toBe(2)
    expect(cache.has('con_1', 'h', 'p')).toBe(false)
    expect(cache.has('con_3', 'h', 'p')).toBe(true)
  })
})
