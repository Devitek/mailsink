import { describe, expect, it } from 'vitest'
import { createMailsink } from '../src'
import { createServerClock } from '../src/clock'

const at = (iso: string) => Date.parse(iso)

describe('server clock', () => {
  it('reads the client clock until a Date header was seen', () => {
    const clock = createServerClock(() => at('2026-01-01T10:00:00.500Z'))
    expect(clock.now().toISOString()).toBe('2026-01-01T10:00:00.500Z')
    expect(clock.offset()).toBe(0)
  })

  it('keeps the client clock when the header agrees within its one second precision', () => {
    const clock = createServerClock(() => at('2026-01-01T10:00:00.700Z'))
    clock.observe(
      'Thu, 01 Jan 2026 10:00:00 GMT',
      at('2026-01-01T10:00:00.600Z'),
      at('2026-01-01T10:00:00.700Z'),
    )
    expect(clock.offset()).toBe(0)
  })

  it('corrects only the proven part of a server running ahead', () => {
    let now = at('2026-01-01T10:00:00.100Z')
    const clock = createServerClock(() => now)
    // Sent at .000, received at .100: the server said 10:00:05, so it is at least 4.9 s ahead.
    clock.observe('Thu, 01 Jan 2026 10:00:05 GMT', at('2026-01-01T10:00:00.000Z'), now)
    expect(clock.offset()).toBe(4_900)
    now += 1_000
    expect(clock.now().toISOString()).toBe('2026-01-01T10:00:06.000Z')
  })

  it('corrects only the proven part of a server running behind', () => {
    const clock = createServerClock(() => at('2026-01-01T10:00:10.000Z'))
    // Sent at 10:00:10.000: the server read at most 10:00:03.999 while answering.
    clock.observe(
      'Thu, 01 Jan 2026 10:00:03 GMT',
      at('2026-01-01T10:00:10.000Z'),
      at('2026-01-01T10:00:10.050Z'),
    )
    expect(clock.offset()).toBe(-6_000)
  })

  it('ignores a missing or invalid header', () => {
    const clock = createServerClock(() => 0)
    clock.observe(null, 0, 0)
    clock.observe('not a date', 0, 0)
    expect(clock.offset()).toBe(0)
  })
})

describe('client.now', () => {
  it('follows the Date header of the answers, shared by clients of the same URL', async () => {
    const ahead = new Date(Date.now() + 60_000)
    const fetch = async () =>
      Response.json({ data: [], nextCursor: null }, { headers: { date: ahead.toUTCString() } })
    const sink = createMailsink({ url: 'https://sink.test', key: 'mskw_k', fetch })
    expect(Math.abs(sink.now().getTime() - Date.now())).toBeLessThan(1_000)
    await sink.messages.list()
    const scoped = sink.with({ key: 'mskw_other' })
    for (const client of [sink, scoped]) {
      expect(client.now().getTime() - Date.now()).toBeGreaterThan(58_000)
    }
    const elsewhere = sink.with({ url: 'https://other.test' })
    expect(Math.abs(elsewhere.now().getTime() - Date.now())).toBeLessThan(1_000)
  })

  it('makes waitFor default `since` to the server time', async () => {
    const ahead = () => new Date(Date.now() + 60_000).toUTCString()
    const queries: URLSearchParams[] = []
    const fetch = async (input: RequestInfo | URL) => {
      const url = new URL(String(input))
      queries.push(url.searchParams)
      const data = url.pathname.endsWith('/m_1') ? { id: 'm_1' } : { data: [{ id: 'm_1' }] }
      return Response.json(data, { headers: { date: ahead() } })
    }
    const sink = createMailsink({ url: 'https://sink.test', key: 'mskw_k', fetch })
    await sink.messages.list()
    await sink.messages.waitFor({ to: 'user@example.com' })
    const since = Date.parse(queries[1]?.get('since') ?? '')
    expect(since - Date.now()).toBeGreaterThan(58_000)
  })
})
