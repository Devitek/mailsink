import { DomainError } from '@mailsink/core'
import type { z } from 'zod'
import type { ApiExtension } from '../../extensions'
import { INGESTION_EXTENSIONS, RATE_LIMIT_HEADERS } from '../../ingestion-guard'
import { type InputSource, parseInput } from '../../validation'
import { asBrevoStatus } from './errors'

// Shared parts of the Brevo routes (`/v3/smtp/*`, #29, #149).

/** Brevo's own rate limit headers, mirrored from the `X-RateLimit-*` ones (D91). */
export const BREVO_RATE_LIMIT_HEADERS = {
  [RATE_LIMIT_HEADERS.limit]: 'x-sib-ratelimit-limit',
  [RATE_LIMIT_HEADERS.remaining]: 'x-sib-ratelimit-remaining',
  [RATE_LIMIT_HEADERS.reset]: 'x-sib-ratelimit-reset',
} as const

const brevoRateLimitHeaders: ApiExtension = {
  name: 'brevo-rate-limit-headers',
  onResponse: (_ctx, response) => {
    for (const [from, to] of Object.entries(BREVO_RATE_LIMIT_HEADERS)) {
      const value = response.headers.get(from)
      if (value !== null) response.headers.set(to, value)
    }
  },
}

/**
 * Only the keys of a `brevo` connection: another kind, a workspace key or the Admin key is a
 * 403 (`permission_denied`), before the rate limit spends a token.
 */
const brevoConnectionOnly: ApiExtension = {
  name: 'brevo-connection-only',
  afterAuth: ({ auth }) => {
    const kind = auth?.kind === 'workspace' ? auth.connection?.kind : undefined
    if (kind !== 'brevo') {
      throw new DomainError('forbidden', 'This route needs the key of a brevo connection')
    }
  },
}

/** Extensions of every Brevo route: kind check, ingestion guard (D92), Brevo headers. */
export const BREVO_EXTENSIONS: readonly ApiExtension[] = [
  brevoConnectionOnly,
  ...INGESTION_EXTENSIONS,
  brevoRateLimitHeaders,
]

/** Parses a Brevo input: an invalid one answers 400, never 422 (D127). */
export async function parseBrevoInput<S extends z.ZodType>(
  schema: S,
  value: unknown,
  source: InputSource,
): Promise<z.output<S>> {
  try {
    return await parseInput(schema, value, source)
  } catch (error) {
    throw asBrevoStatus(error)
  }
}
