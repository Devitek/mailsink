import { WEBHOOK_RESPONSE_MAX_CHARS, WEBHOOK_TIMEOUT_MS } from './retry'

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

export interface SendResult {
  status: number | null
  body: string | null
  durationMs: number
  /** Network failure, timeout, TLS…: no HTTP status. */
  error: string | null
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
  try {
    const response = await doFetch(url, {
      method: 'POST',
      headers,
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
