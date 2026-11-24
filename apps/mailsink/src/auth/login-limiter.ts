// Sign-in attempts per client (B2-3, D161): `maxAttempts` failures within
// `lockSeconds` pause that client for `lockSeconds`. The pause is never extended by the
// refused attempts it answers, so the countdown shown on L1e stays true. In memory, like
// the ingestion rate limiter (single process, D3). The remaining attempts are never exposed
// (B2-2).

export interface LoginLimiterOptions {
  maxAttempts: number
  lockSeconds: number
  now?: () => number
}

export interface LoginLimiter {
  /** Seconds before this client may try again; 0 when it may try now. */
  retryAfter(client: string): number
  fail(client: string): void
  succeed(client: string): void
  /** Tracked clients (tests). */
  size(): number
}

type Entry = { failures: number[]; lockedUntil: number }

export function createLoginLimiter({
  maxAttempts,
  lockSeconds,
  now = Date.now,
}: LoginLimiterOptions): LoginLimiter {
  const windowMs = lockSeconds * 1000
  const entries = new Map<string, Entry>()

  function prune(at: number) {
    for (const [client, entry] of entries) {
      const recent = entry.failures.some((t) => at - t < windowMs)
      if (entry.lockedUntil <= at && !recent) entries.delete(client)
    }
  }

  return {
    retryAfter(client) {
      const lockedUntil = entries.get(client)?.lockedUntil ?? 0
      return Math.max(0, Math.ceil((lockedUntil - now()) / 1000))
    },
    fail(client) {
      const at = now()
      prune(at)
      const entry = entries.get(client) ?? { failures: [], lockedUntil: 0 }
      entry.failures = [...entry.failures.filter((t) => at - t < windowMs), at]
      if (entry.failures.length >= maxAttempts) {
        entry.lockedUntil = at + windowMs
        entry.failures = []
      }
      entries.set(client, entry)
    },
    succeed(client) {
      entries.delete(client)
    },
    size: () => entries.size,
  }
}
