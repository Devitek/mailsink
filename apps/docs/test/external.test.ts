import { describe, expect, it, vi } from 'vitest'
import {
  CACHE_TTL_MS,
  checkUrls,
  classify,
  externalUrls,
  isSkipped,
  probe,
} from '../scripts/checks/external'

const answer = (status: number) => Promise.resolve({ status })

describe('externalUrls', () => {
  it('lists http(s) links once, hash dropped and entities decoded', () => {
    const html =
      '<a href="https://acme.dev/a#x">a</a><a href="https://acme.dev/a">b</a>' +
      '<a href="http://acme.dev/q?a=1&amp;b=2">c</a><a href="/local/">d</a>'
    expect(externalUrls(html)).toEqual(['https://acme.dev/a', 'http://acme.dev/q?a=1&b=2'])
  })
})

describe('isSkipped', () => {
  it('skips local instances, reserved example domains, this site and this repository', () => {
    for (const url of [
      'http://localhost:3000/emails',
      'http://127.0.0.1:1025',
      'https://api.example.com/hook',
      'https://hooks.acme.test/x',
      'https://mailsink.devitek.fr/guides/sdk/',
      'https://github.com/Devitek/mailsink/releases/tag/v9.9.9',
      'https://raw.githubusercontent.com/Devitek/mailsink/main/docs/a.png',
    ]) {
      expect(isSkipped(url), url).toBe(true)
    }
    expect(isSkipped('https://github.com/Devitek/mailsink-other')).toBe(false)
    expect(isSkipped('https://www.npmjs.com/package/@devitek/mailsink')).toBe(false)
  })
})

describe('classify and probe', () => {
  it('only calls 404 and 410 broken; refusals and server errors are unreachable', () => {
    expect([200, 301, 404, 410, 403, 429, 503].map(classify)).toEqual([
      'ok',
      'ok',
      'broken',
      'broken',
      'unreachable',
      'unreachable',
      'unreachable',
    ])
  })

  it('retries with GET when HEAD is refused, and treats a network failure as unreachable', async () => {
    const fetcher = vi.fn((_url: string, init: RequestInit) =>
      answer(init.method === 'HEAD' ? 405 : 200),
    )
    expect(await probe('https://acme.dev', fetcher)).toBe('ok')
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(
      await probe('https://acme.dev', () => Promise.reject(new TypeError('fetch failed'))),
    ).toBe('unreachable')
  })
})

describe('checkUrls', () => {
  it('skips fresh cached successes, caches new ones and forgets failures', async () => {
    const now = 1_000_000_000_000
    const cache = {
      'https://fresh.dev': now - 1000,
      'https://stale.dev': now - CACHE_TTL_MS - 1,
      'https://gone.dev': now - CACHE_TTL_MS - 1,
    }
    const fetcher = vi.fn((url: string) => answer(url.includes('gone') ? 404 : 200))
    const results = await checkUrls(
      ['https://fresh.dev', 'https://stale.dev', 'https://gone.dev'],
      {
        fetcher,
        cache,
        now,
      },
    )
    expect(Object.fromEntries(results)).toEqual({
      'https://fresh.dev': 'ok',
      'https://stale.dev': 'ok',
      'https://gone.dev': 'broken',
    })
    expect(fetcher.mock.calls.map(([url]) => url)).not.toContain('https://fresh.dev')
    expect(cache).toEqual({ 'https://fresh.dev': now - 1000, 'https://stale.dev': now })
  })
})
