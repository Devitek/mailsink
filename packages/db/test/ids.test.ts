import { describe, expect, it } from 'vitest'
import { newId } from '../src/ids'

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('newId', () => {
  it('prefixes a UUIDv7 body', () => {
    const id = newId('ws')
    expect(id.startsWith('ws_')).toBe(true)
    expect(id.slice(3)).toMatch(UUID_V7)
  })

  it('encodes the creation time in the first 48 bits', () => {
    const before = Date.now()
    const id = newId('msg', before)
    const hex = id.slice(4, 17).replace('-', '')
    expect(Number.parseInt(hex, 16)).toBe(before)
  })

  it('sorts lexicographically by creation time', () => {
    const ids = [3, 1, 2].map((offset) => newId('evt', 1_700_000_000_000 + offset))
    expect([...ids].sort()).toEqual([ids[1], ids[2], ids[0]])
  })

  it('never repeats', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId('con')))
    expect(ids.size).toBe(1000)
  })
})
