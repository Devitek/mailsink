// Shared by the SDK (`mailsink.now()`, `waitFor`) and the web UI (ephemeral banner).

/**
 * Estimate of the server clock from the `Date` header of its answers (D261). The header
 * has a one second precision and is written somewhere between the request and the answer,
 * so each answer only bounds the offset (server minus client): the clock keeps the
 * narrowest consistent bounds and corrects the client clock by the smallest offset they
 * allow, i.e. only by the skew that is proven. Without any header (no answer yet, or a
 * cross-origin browser call that cannot read it) it is the client clock.
 */
export interface ServerClock {
  /** Current time of the server, best estimate. */
  now(): Date
  /** Offset applied to the client clock, in ms (0 while unproven). */
  offset(): number
  /** Records the `Date` header of an answer sent at `sentAt` and received at `receivedAt`. */
  observe(dateHeader: string | null, sentAt: number, receivedAt: number): void
}

const HEADER_PRECISION_MS = 1_000

export function createServerClock(clientNow: () => number = Date.now): ServerClock {
  let lower = Number.NEGATIVE_INFINITY
  let upper = Number.POSITIVE_INFINITY
  const offset = () => Math.min(Math.max(0, lower), upper)
  return {
    now: () => new Date(clientNow() + offset()),
    offset,
    observe(dateHeader, sentAt, receivedAt) {
      const serverAt = dateHeader ? Date.parse(dateHeader) : Number.NaN
      if (Number.isNaN(serverAt)) return
      const low = serverAt - receivedAt
      const high = serverAt + HEADER_PRECISION_MS - sentAt
      // Narrow with the previous bounds; start over if they disagree (the server clock moved).
      if (Math.max(low, lower) <= Math.min(high, upper)) {
        lower = Math.max(low, lower)
        upper = Math.min(high, upper)
      } else {
        lower = low
        upper = high
      }
    },
  }
}
