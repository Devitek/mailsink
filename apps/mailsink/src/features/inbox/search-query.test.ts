import { ListMessagesQuery, type MessageSummary } from '@mailsink/contracts'
import { describe, expect, it } from 'vitest'
import { matchesFilters, parseSearchBox, toListQuery } from './search-query'

describe('inbox search box', () => {
  it('sends plain words to the full text search', () => {
    expect(parseSearchBox('booking confirmed')).toEqual({ q: 'booking confirmed' })
    expect(parseSearchBox(undefined)).toEqual({})
  })

  it('reads to: and from: operators, quoted or not', () => {
    expect(parseSearchBox('to:jane@acme.io from:"Live WOD" invoice')).toEqual({
      to: 'jane@acme.io',
      from: 'Live WOD',
      q: 'invoice',
    })
    expect(parseSearchBox('FROM:billing')).toEqual({ from: 'billing' })
  })

  it('searches recipients for a lone address or domain', () => {
    expect(parseSearchBox('@gmail.test')).toEqual({ to: '@gmail.test' })
    expect(parseSearchBox('julie.martin@')).toEqual({ to: 'julie.martin@' })
    expect(parseSearchBox('to:x a@b')).toEqual({ to: 'x', q: 'a@b' })
  })

  it('builds a valid Capture list query', () => {
    const query = toListQuery(
      { q: 'to:jane', status: 'hard_bounce', connectionId: 'con_1', tag: 'env:staging' },
      'cursor',
      100,
    )
    expect(ListMessagesQuery.parse(query)).toMatchObject({
      to: 'jane',
      status: ['hard_bounce'],
      connectionId: 'con_1',
      tag: 'env:staging',
      cursor: 'cursor',
      limit: 100,
    })
    expect(toListQuery({}, undefined, 50)).toEqual({ limit: 50 })
  })
})

describe('stream messages against the filters', () => {
  const message = {
    id: 'msg_1',
    connectionId: 'con_1',
    status: 'delivered',
    tags: [{ name: 'env', value: 'staging' }],
  } as MessageSummary

  it('tells what the browser can check', () => {
    expect(matchesFilters({}, message)).toBe(true)
    expect(matchesFilters({ status: 'delivered', tag: 'env' }, message)).toBe(true)
    expect(matchesFilters({ tag: 'env:staging', connectionId: 'con_1' }, message)).toBe(true)
    expect(matchesFilters({ status: 'failed' }, message)).toBe(false)
    expect(matchesFilters({ connectionId: 'con_2' }, message)).toBe(false)
    expect(matchesFilters({ tag: 'env:prod' }, message)).toBe(false)
  })

  it('leaves the search box to the server', () => {
    expect(matchesFilters({ q: 'invoice' }, message)).toBeUndefined()
    expect(matchesFilters({ q: 'invoice', status: 'failed' }, message)).toBe(false)
  })
})
