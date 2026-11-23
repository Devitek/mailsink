import type { RateLimitSettings } from '@mailsink/contracts'

/** Outcome of one `take`, enough to build the `X-RateLimit-*` headers or an SMTP reply. */
export interface RateLimitDecision {
  allowed: boolean
  /** Tokens per window (`X-RateLimit-Limit`). */
  limit: number
  /** Whole tokens left after this call (`X-RateLimit-Remaining`). */
  remaining: number
  /** Seconds until the bucket is full again (`X-RateLimit-Reset`). */
  resetSeconds: number
  /** Seconds until one token is back (`Retry-After`); null when allowed. */
  retryAfterSeconds: number | null
}

export interface RateLimiter {
  /** Takes one token from the bucket of `key` (a connection id, D7). */
  take(key: string, settings: RateLimitSettings): RateLimitDecision
  /** Buckets currently held in memory. */
  size(): number
}

export interface RateLimiterOptions {
  /** Clock in milliseconds, injectable for tests. */
  now?: () => number
  /** Above this many buckets, full (idle) ones are dropped. */
  maxBuckets?: number
}

interface Bucket {
  signature: string
  capacity: number
  ratePerMs: number
  tokens: number
  updatedAt: number
}

/** Float tolerance: 5 000 ms at 0.0002 token/ms must give exactly one token. */
const EPSILON = 1e-9

function newBucket(settings: RateLimitSettings, at: number): Bucket {
  const capacity = settings.burst ?? settings.limit
  return {
    signature: `${settings.limit}/${settings.windowSeconds}/${settings.burst ?? ''}`,
    capacity,
    ratePerMs: settings.limit / (settings.windowSeconds * 1000),
    tokens: capacity,
    updatedAt: at,
  }
}

function refill(bucket: Bucket, at: number): void {
  const elapsed = Math.max(0, at - bucket.updatedAt)
  bucket.tokens = Math.min(bucket.capacity, bucket.tokens + elapsed * bucket.ratePerMs)
  bucket.updatedAt = at
}

/** Whole seconds needed to earn `tokens` back. */
const secondsFor = (bucket: Bucket, tokens: number) =>
  Math.ceil(Math.max(0, tokens - EPSILON) / bucket.ratePerMs / 1000)

/**
 * In-memory token bucket per key (D7, single instance D3). Capacity is `burst`, else
 * `limit`; tokens come back continuously at `limit / windowSeconds` per second. A bucket
 * whose settings changed (an override activated or reset) starts over full.
 */
export function createRateLimiter(options: RateLimiterOptions = {}): RateLimiter {
  const now = options.now ?? Date.now
  const maxBuckets = options.maxBuckets ?? 10_000
  const buckets = new Map<string, Bucket>()

  const sweep = (at: number) => {
    for (const [key, bucket] of buckets) {
      refill(bucket, at)
      if (bucket.tokens + EPSILON >= bucket.capacity) buckets.delete(key)
    }
  }

  return {
    take(key, settings) {
      const at = now()
      let bucket = buckets.get(key)
      const fresh = newBucket(settings, at)
      if (!bucket || bucket.signature !== fresh.signature) {
        bucket = fresh
        buckets.delete(key)
        // Before inserting: the new bucket is full and would be swept at once.
        if (buckets.size >= maxBuckets) sweep(at)
        buckets.set(key, bucket)
      }
      refill(bucket, at)
      const allowed = bucket.tokens + EPSILON >= 1
      if (allowed) bucket.tokens = Math.max(0, bucket.tokens - 1)
      return {
        allowed,
        limit: settings.limit,
        remaining: Math.floor(bucket.tokens + EPSILON),
        resetSeconds: secondsFor(bucket, bucket.capacity - bucket.tokens),
        retryAfterSeconds: allowed ? null : Math.max(1, secondsFor(bucket, 1 - bucket.tokens)),
      }
    },
    size: () => buckets.size,
  }
}
