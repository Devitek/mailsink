// External link check of the built site (D272): every http(s) link is requested once, a
// success is cached for a week. Tolerant by design, so CI does not flake on third-party
// sites: only a definite answer (404, 410) is broken; a refusal (401, 403, 429), a server
// error or a network failure is reported as unreachable, an error in strict mode only.

export type Outcome = 'ok' | 'broken' | 'unreachable'

/** Successes by URL, with the time they were checked (ms). */
export type LinkCache = Record<string, number>

export const CACHE_TTL_MS = 7 * 24 * 3600 * 1000

/** Hosts never requested: local instances, reserved example domains, this site. */
const SKIPPED_HOST =
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0|mailsink\.devitek\.fr)$|(^|\.)(example\.(com|org|net)|test|example|invalid)$/

/**
 * Links into this repository are skipped too: the sync checks every repository path they
 * point to, and a release or tag link only exists once the release is cut.
 */
const SKIPPED_URL =
  /^https:\/\/(github\.com|raw\.githubusercontent\.com)\/Devitek\/mailsink([/#?]|$)/

export function isSkipped(url: string): boolean {
  return SKIPPED_HOST.test(new URL(url).hostname) || SKIPPED_URL.test(url)
}

/** External http(s) targets of a page, hash dropped, deduplicated. */
export function externalUrls(html: string): string[] {
  const urls = new Set<string>()
  for (const match of html.matchAll(/\shref="(https?:\/\/[^"#]+)/g)) {
    if (match[1]) urls.add(match[1].replaceAll('&amp;', '&'))
  }
  return [...urls]
}

export function classify(status: number): Outcome {
  if (status < 400) return 'ok'
  return status === 404 || status === 410 ? 'broken' : 'unreachable'
}

type Fetch = (
  url: string,
  init: RequestInit,
) => Promise<{ status: number; body?: ReadableStream | null }>

/** HEAD first; some servers refuse it, so any non-success is retried with GET. */
export async function probe(url: string, fetcher: Fetch, timeoutMs = 10_000): Promise<Outcome> {
  let outcome: Outcome = 'unreachable'
  for (const method of ['HEAD', 'GET']) {
    try {
      const response = await fetcher(url, {
        method,
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'user-agent': 'mailsink-docs-link-check (+https://github.com/Devitek/mailsink)',
        },
      })
      outcome = classify(response.status)
      // Only the status matters: drop the body rather than download it.
      await response.body?.cancel()
    } catch {
      outcome = 'unreachable'
    }
    if (outcome === 'ok') break
  }
  return outcome
}

export interface CheckOptions {
  fetcher: Fetch
  cache: LinkCache
  now: number
  concurrency?: number
}

/** Checks the URLs not fresh in the cache; records new successes in it. */
export async function checkUrls(
  urls: readonly string[],
  { fetcher, cache, now, concurrency = 8 }: CheckOptions,
): Promise<Map<string, Outcome>> {
  const results = new Map<string, Outcome>()
  const queue = urls.filter((url) => {
    const checkedAt = cache[url]
    if (checkedAt !== undefined && now - checkedAt < CACHE_TTL_MS) results.set(url, 'ok')
    return !results.has(url)
  })
  const worker = async () => {
    for (let url = queue.shift(); url !== undefined; url = queue.shift()) {
      const outcome = await probe(url, fetcher)
      results.set(url, outcome)
      if (outcome === 'ok') cache[url] = now
      else delete cache[url]
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  return results
}
