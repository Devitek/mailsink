import { describe, expect, it } from 'vitest'
import { Address, AddressList, parseAddress } from './address'

describe('parseAddress', () => {
  it('parses a bare e-mail', () => {
    expect(parseAddress('Jane@X.io')).toEqual({ email: 'jane@x.io' })
  })
  it('parses "Name <email>"', () => {
    expect(parseAddress('Jane Doe <jane@x.io>')).toEqual({ email: 'jane@x.io', name: 'Jane Doe' })
  })
  it('unquotes a quoted display name', () => {
    expect(parseAddress('"Doe, Jane" <jane@x.io>')).toEqual({
      email: 'jane@x.io',
      name: 'Doe, Jane',
    })
  })
  it('accepts "<email>" without a name', () => {
    expect(parseAddress('<jane@x.io>')).toEqual({ email: 'jane@x.io' })
  })
  it.each(['jane', 'Jane <jane>', 'Jane <jane@x.io', ''])('rejects %j', (input) => {
    expect(parseAddress(input)).toBeNull()
  })
})

describe('Address', () => {
  it('parses the string form', () => {
    expect(Address.parse('Jane <jane@x.io>')).toEqual({ email: 'jane@x.io', name: 'Jane' })
  })
  it('parses the object form', () => {
    expect(Address.parse({ email: 'JANE@x.io', name: ' Jane ' })).toEqual({
      email: 'jane@x.io',
      name: 'Jane',
    })
  })
  it('drops an empty name', () => {
    expect(Address.parse({ email: 'jane@x.io', name: '' })).toEqual({ email: 'jane@x.io' })
  })
  it('rejects a display name inside the object e-mail', () => {
    expect(Address.safeParse({ email: 'Jane <jane@x.io>' }).success).toBe(false)
  })
  it('reports invalid_address', () => {
    const result = Address.safeParse('nope')
    expect(result.error?.issues[0]).toMatchObject({ params: { code: 'invalid_address' } })
  })
})

describe('AddressList', () => {
  it('wraps a single address in an array', () => {
    expect(AddressList.parse('jane@x.io')).toEqual([{ email: 'jane@x.io' }])
  })
  it('parses a mixed array', () => {
    expect(AddressList.parse(['Jane <jane@x.io>', { email: 'bob@x.io' }])).toEqual([
      { email: 'jane@x.io', name: 'Jane' },
      { email: 'bob@x.io' },
    ])
  })
  it('fails when one item is invalid', () => {
    expect(AddressList.safeParse(['jane@x.io', 'nope']).success).toBe(false)
  })
})
