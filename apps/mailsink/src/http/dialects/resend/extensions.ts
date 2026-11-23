import { DomainError } from '@mailsink/core'
import type { ApiExtension } from '../../extensions'
import { INGESTION_EXTENSIONS, RATE_LIMIT_HEADERS } from '../../ingestion-guard'

/** Resend's IETF draft headers, copied from the `X-RateLimit-*` ones of the ingestion guard. */
export const RESEND_RATE_LIMIT_HEADERS = {
  [RATE_LIMIT_HEADERS.limit]: 'ratelimit-limit',
  [RATE_LIMIT_HEADERS.remaining]: 'ratelimit-remaining',
  [RATE_LIMIT_HEADERS.reset]: 'ratelimit-reset',
} as const

/**
 * Only the keys of a `resend` connection: another kind (Brevo, SMTP) is a 403, answered in
 * Resend's body shape, before the rate limit spends a token.
 */
export const resendConnectionOnly: ApiExtension = {
  name: 'resend-connection-only',
  afterAuth: ({ auth }) => {
    const kind = auth?.kind === 'workspace' ? auth.connection?.kind : undefined
    if (kind && kind !== 'resend') {
      throw new DomainError(
        'forbidden',
        `This API key belongs to a ${kind} connection: use the key of a resend connection`,
      )
    }
  },
}

/** Adds `ratelimit-limit`, `ratelimit-remaining` and `ratelimit-reset` next to `X-RateLimit-*`. */
export const resendRateLimitHeaders: ApiExtension = {
  name: 'resend-rate-limit-headers',
  onResponse: (_ctx, response) => {
    for (const [from, to] of Object.entries(RESEND_RATE_LIMIT_HEADERS)) {
      const value = response.headers.get(from)
      if (value !== null) response.headers.set(to, value)
    }
  },
}

/** Extensions of every Resend route: kind check, ingestion guard, Resend headers. */
export const RESEND_EXTENSIONS: readonly ApiExtension[] = [
  resendConnectionOnly,
  ...INGESTION_EXTENSIONS,
  resendRateLimitHeaders,
]
