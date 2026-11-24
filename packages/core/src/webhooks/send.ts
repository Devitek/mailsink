import { WEBHOOK_RESPONSE_MAX_CHARS, WEBHOOK_TIMEOUT_MS } from './retry'
import { basicAuthorization, splitUrlCredentials } from './url-credentials'

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

export interface SendResult {
  status: number | null
  body: string | null
  durationMs: number
  /** Network failure, timeout, TLS…: no HTTP status. */
  error: string | null
}

/**
 * Credentials left in a URL stored before D278 (`fetch` refuses them): sent as the
 * `Authorization` header unless the attempt already has one.
 */
function withoutUrlCredentials(url: string, headers: Record<string, string>) {
  const { url: bare, basic } = splitUrlCredentials(url)
  if (!basic) return { url, headers }
  const hasAuth = Object.keys(headers).some((k) => k.toLowerCase() === 'authorization')
  return {
    url: bare,
    headers: hasAuth ? headers : { ...headers, Authorization: basicAuthorization(basic) },
  }
}

/**
 * POSTs the stored body with the attempt headers. Redirects are not followed (a 3xx is a
 * failure, like Svix); the response body is kept truncated to 4 KB.
 */
export async function sendWebhook(
  url: string,
  headers: Record<string, string>,
  body: string,
  options: { fetch?: FetchLike; timeoutMs?: number } = {},
): Promise<SendResult> {
  const doFetch = options.fetch ?? fetch
  const started = performance.now()
  const elapsed = () => Math.round(performance.now() - started)
  const target = withoutUrlCredentials(url, headers)
  try {
    const response = await doFetch(target.url, {
      method: 'POST',
      headers: target.headers,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(options.timeoutMs ?? WEBHOOK_TIMEOUT_MS),
    })
    const text = await response.text().catch(() => '')
    return {
      status: response.status,
      body: text.slice(0, WEBHOOK_RESPONSE_MAX_CHARS),
      durationMs: elapsed(),
      error: null,
    }
  } catch (error) {
    return { status: null, body: null, durationMs: elapsed(), error: describe(error) }
  }
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'TimeoutError') return 'timeout'
    const cause = (error as { cause?: { code?: string; message?: string } }).cause
    return cause?.code ?? cause?.message ?? error.message
  }
  return String(error)
}

export const isSuccess = (status: number | null): boolean =>
  status !== null && status >= 200 && status < 300
