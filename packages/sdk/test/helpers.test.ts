import { describe, expect, it } from 'vitest'
import { extractCode, extractLinks, findLink } from '../src'
import { filenameOf } from '../src/capture/messages'
import { toSearchParams } from '../src/query'

describe('extractLinks and findLink', () => {
  const message = {
    links: [{ url: 'https://app.test/a' }],
    html: `<a href="https://app.test/verify?t=1&amp;u=2">Verify</a> <a href='mailto:x@y.z'>m</a>
      <a href=https://app.test/b>b</a> <a href="https://app.test/a">dup</a>`,
    text: 'Open https://app.test/text?x=1. Thanks',
  }

  it('collects server links, hrefs and bare text URLs, http(s) only, once each', () => {
    expect(extractLinks(message)).toEqual([
      'https://app.test/a',
      'https://app.test/verify?t=1&u=2',
      'https://app.test/b',
      'https://app.test/text?x=1',
    ])
    expect(extractLinks({})).toEqual([])
  })

  it('matches a substring, a RegExp (global or not) or a predicate', () => {
    expect(findLink(message, '/verify')).toBe('https://app.test/verify?t=1&u=2')
    const global = /\/b$/g
    expect(findLink(message, global)).toBe('https://app.test/b')
    expect(findLink(message, global)).toBe('https://app.test/b')
    expect(findLink(message, (url) => url.searchParams.get('x') === '1')).toBe(
      'https://app.test/text?x=1',
    )
    expect(findLink(message, 'nope')).toBeNull()
  })
})

describe('extractCode', () => {
  it('finds the first standalone code in the subject, text then visible HTML', () => {
    expect(extractCode({ subject: '123456 is your code', text: '654321' })).toBe('123456')
    expect(extractCode({ subject: 'Sign in', text: 'Order 1234567, code 987654.' })).toBe('987654')
    expect(
      extractCode({ html: '<style>.c{width:111111px}</style><p>Code: <b>246810</b></p>' }),
    ).toBe('246810')
  })

  it('skips digits inside URLs and honours length and pattern', () => {
    expect(extractCode({ text: 'https://a.test/u/123456 then 777777' })).toBe('777777')
    expect(extractCode({ text: 'PIN 4321' }, { length: 4 })).toBe('4321')
    expect(extractCode({ text: 'code: AB-12' }, { pattern: /code: ([A-Z]{2}-\d{2})/ })).toBe(
      'AB-12',
    )
    expect(extractCode({ text: 'no code' })).toBeNull()
  })
})

describe('filenameOf and toSearchParams', () => {
  it('reads RFC 6266 file names', () => {
    expect(filenameOf(`attachment; filename="caf_.txt"; filename*=UTF-8''caf%C3%A9.txt`)).toBe(
      'café.txt',
    )
    expect(filenameOf('attachment; filename="a \\"b\\".txt"')).toBe('a "b".txt')
    expect(filenameOf('inline')).toBeNull()
    expect(filenameOf(null)).toBeNull()
  })

  it('serializes queries: arrays comma-joined, dates in ISO, empty values left out', () => {
    const since = new Date('2026-01-02T03:04:05.000Z')
    const params = toSearchParams({
      status: ['delivered', 'failed'],
      since,
      wait: true,
      limit: 5,
      to: undefined,
      x: null,
      empty: [],
    })
    expect(params.toString()).toBe(
      'status=delivered%2Cfailed&since=2026-01-02T03%3A04%3A05.000Z&wait=true&limit=5',
    )
  })
})
