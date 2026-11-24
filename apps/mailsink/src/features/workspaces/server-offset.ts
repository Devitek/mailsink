import { createServerClock } from '@mailsink/contracts'

type Fetch = (input: string, init?: RequestInit) => Promise<Response>

/**
 * Offset of the server clock over the browser one, in ms, from the `Date` header of one
 * `/healthz` answer (D261): only the skew that header proves, 0 when it agrees within its
 * one second precision, is missing, or the probe fails.
 */
export async function measureServerOffset(doFetch: Fetch = (i, o) => fetch(i, o)) {
  const clock = createServerClock()
  try {
    const sentAt = Date.now()
    const response = await doFetch('/healthz', { cache: 'no-store' })
    clock.observe(response.headers.get('date'), sentAt, Date.now())
  } catch {
    // Unreachable: the browser clock stays the reference.
  }
  return clock.offset()
}
