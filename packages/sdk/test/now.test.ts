import { describe, expect, it } from 'vitest'
import { createMailsink } from '../src'

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
