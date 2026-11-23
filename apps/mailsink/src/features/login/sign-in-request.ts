// Browser side of `POST /login` (03-contracts « Web UI auth »).

export type SignInResult =
  | { kind: 'signed-in' }
  | { kind: 'rejected' }
  | { kind: 'paused'; retryAfter: number }
  | { kind: 'failed' }

/** `Retry-After` in seconds (the only form the server sends); 60 if unreadable. */
export function parseRetryAfter(value: string | null): number {
  const seconds = Number(value)
  return Number.isInteger(seconds) && seconds > 0 ? seconds : 60
}

export async function requestSignIn(
  key: string,
  fetcher: typeof fetch = fetch,
): Promise<SignInResult> {
  try {
    const response = await fetcher('/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key }),
      credentials: 'same-origin',
    })
    if (response.ok) return { kind: 'signed-in' }
    if (response.status === 401) return { kind: 'rejected' }
    if (response.status === 429) {
      return { kind: 'paused', retryAfter: parseRetryAfter(response.headers.get('retry-after')) }
    }
    return { kind: 'failed' }
  } catch {
    return { kind: 'failed' }
  }
}

/** `0:42`, `1:05`: the countdown of L1e. */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
