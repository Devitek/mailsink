import {
  DomainError,
  guardRequest,
  loadEffectiveSettings,
  type RateLimitDecision,
} from '@mailsink/core'
import type { ApiExtension } from './extensions'

export const RATE_LIMIT_HEADERS = {
  limit: 'X-RateLimit-Limit',
  remaining: 'X-RateLimit-Remaining',
  reset: 'X-RateLimit-Reset',
  retryAfter: 'Retry-After',
} as const

/** The `X-RateLimit-*` headers of a decision, plus `Retry-After` when it was denied. */
export function rateLimitHeaders(decision: RateLimitDecision): Record<string, string> {
  const headers: Record<string, string> = {
    [RATE_LIMIT_HEADERS.limit]: String(decision.limit),
    [RATE_LIMIT_HEADERS.remaining]: String(decision.remaining),
    [RATE_LIMIT_HEADERS.reset]: String(decision.resetSeconds),
  }
  if (decision.retryAfterSeconds !== null) {
    headers[RATE_LIMIT_HEADERS.retryAfter] = String(decision.retryAfterSeconds)
  }
  return headers
}

/** Decision of each request in flight, read back by `onResponse` for the headers. */
const decisions = new WeakMap<Request, RateLimitDecision>()

/**
 * Rate limit (#24) and request-level chaos (#25) of the ingestion routes: native `/v1`
 * now, the Resend and Brevo dialects (#28, #29) through `INGESTION_EXTENSIONS`. Runs after
 * authentication and before the body is read: a refused call stores nothing. Settings come
 * from the resolver (connection override > workspace override > connection > workspace).
 */
export const ingestionGuardExtension: ApiExtension = {
  name: 'ingestion-guard',
  afterAuth: async ({ request, requestId, runtime, auth }) => {
    if (auth?.kind !== 'workspace' || !auth.connection) return
    const connection = auth.connection
    const settings = await loadEffectiveSettings(
      runtime.db.db,
      auth.workspace.id,
      connection.id,
      new Date(),
    )
    if (!settings) return
    const verdict = guardRequest({
      surface: 'http',
      connectionId: connection.id,
      settings,
      limiter: runtime.rateLimiter,
      random: runtime.chaosRandom,
    })
    if (verdict.rateLimit) decisions.set(request, verdict.rateLimit)
    const rejection = verdict.rejection
    if (rejection?.reason === 'rate_limited') {
      const seconds = verdict.rateLimit?.retryAfterSeconds ?? 1
      throw new DomainError('rate_limited', `Rate limit exceeded, retry in ${seconds}s`)
    }
    if (rejection?.reason === 'chaos_injected') {
      console.info(
        `[mailsink] chaos: ${request.method} ${new URL(request.url).pathname} answered ${rejection.code} (request ${requestId}, connection ${connection.id}, errorCode=chaos_injected)`,
      )
      throw new DomainError('chaos_injected', `Simulated failure (chaos ${rejection.code})`, {
        status: rejection.code,
      })
    }
  },
  onResponse: ({ request }, response) => {
    const decision = decisions.get(request)
    if (!decision) return
    for (const [name, value] of Object.entries(rateLimitHeaders(decision))) {
      response.headers.set(name, value)
    }
  },
}

/** Extensions of every ingestion route (native, Resend, Brevo); never Admin nor Capture. */
export const INGESTION_EXTENSIONS: readonly ApiExtension[] = [ingestionGuardExtension]
