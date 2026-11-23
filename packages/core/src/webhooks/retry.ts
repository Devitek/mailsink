import type { Random } from '../simulation/rng'

// Delivery retries (D24): 8 attempts, delay = min(2^n * 5 s, 1 h) ± 20 %, a 2xx within
// 10 s is a success.

export const WEBHOOK_MAX_ATTEMPTS = 8
export const WEBHOOK_TIMEOUT_MS = 10_000
export const WEBHOOK_RETRY_BASE_MS = 5_000
export const WEBHOOK_RETRY_MAX_MS = 3_600_000
/** Response bodies are stored truncated to 4 KB. */
export const WEBHOOK_RESPONSE_MAX_CHARS = 4096

/**
 * Delay before the attempt following `failedAttempt` (1-based): 5 s after the first, then
 * doubled, capped at 1 h, with a uniform ±20 % jitter.
 */
export function webhookRetryDelayMs(failedAttempt: number, random: Random = Math.random): number {
  const n = Math.max(failedAttempt, 1) - 1
  const base = Math.min(2 ** n * WEBHOOK_RETRY_BASE_MS, WEBHOOK_RETRY_MAX_MS)
  return Math.round(base * (0.8 + random() * 0.4))
}
