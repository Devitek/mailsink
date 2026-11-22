export interface BackoffOptions {
  /** Delay after the first failed attempt (default 5 s). */
  baseSeconds?: number
  /** Upper bound (default 15 min). */
  maxSeconds?: number
}

/** Exponential retry delay: base, 2 x base, 4 x base… after attempt 1, 2, 3…, capped. */
export function backoffSeconds(attempt: number, options: BackoffOptions = {}): number {
  const { baseSeconds = 5, maxSeconds = 900 } = options
  const exponent = Math.max(attempt, 1) - 1
  return Math.min(baseSeconds * 2 ** exponent, maxSeconds)
}
