import { z } from 'zod'
import type { ErrorDialect } from './route'

/** A response header registered once under `components.headers` (referenced elsewhere). */
const header = <T extends z.ZodType>(name: string, schema: T, description: string) =>
  schema.meta({ description, header: { id: name } })

const seconds = z.coerce.number().int().min(0)
const optionalCount = z.coerce.number().int().min(0).optional()

/** Every response of a `defineApi()` route. */
export const REQUEST_ID = {
  'X-Request-Id': header(
    'X-Request-Id',
    z.string(),
    'Id of the request (`req_…`), also the id of its request log row.',
  ),
}

/** Ingestion responses while a rate limit applies (D91): absent when `rateLimit` is null. */
const RATE_LIMIT = {
  'X-RateLimit-Limit': header('X-RateLimit-Limit', optionalCount, 'Requests per window.'),
  'X-RateLimit-Remaining': header(
    'X-RateLimit-Remaining',
    optionalCount,
    'Whole tokens left in the bucket.',
  ),
  'X-RateLimit-Reset': header(
    'X-RateLimit-Reset',
    seconds.optional(),
    'Seconds until the bucket is full again.',
  ),
}

const copy = (name: string, provider: string) =>
  header(name, z.string().optional(), `${provider} copy of the matching X-RateLimit header.`)

/** Provider copies of the rate limit headers, emitted as the provider does. */
const DIALECT_RATE_LIMIT: Record<ErrorDialect, Record<string, z.ZodType>> = {
  native: {},
  resend: {
    'ratelimit-limit': copy('ratelimit-limit', 'Resend'),
    'ratelimit-remaining': copy('ratelimit-remaining', 'Resend'),
    'ratelimit-reset': copy('ratelimit-reset', 'Resend'),
  },
  brevo: {
    'x-sib-ratelimit-limit': copy('x-sib-ratelimit-limit', 'Brevo'),
    'x-sib-ratelimit-remaining': copy('x-sib-ratelimit-remaining', 'Brevo'),
    'x-sib-ratelimit-reset': copy('x-sib-ratelimit-reset', 'Brevo'),
  },
}

export function rateLimitHeaders(dialect: ErrorDialect): Record<string, z.ZodType> {
  return { ...RATE_LIMIT, ...DIALECT_RATE_LIMIT[dialect] }
}

export const RETRY_AFTER = {
  'Retry-After': header('Retry-After', seconds, 'Seconds until one token is back (at least 1).'),
}

export const WWW_AUTHENTICATE = {
  'WWW-Authenticate': header('WWW-Authenticate', z.literal('Bearer'), 'Sent with every 401.'),
}

/** Success of an ingestion call replayed from a previous `Idempotency-Key` (D53). */
export const IDEMPOTENT_REPLAYED = {
  'Idempotent-Replayed': header(
    'Idempotent-Replayed',
    z.literal('true').optional(),
    'Set when the response is replayed for the same Idempotency-Key.',
  ),
}

/** Request header of the ingestion routes. */
export const IDEMPOTENCY_KEY = z.object({
  'Idempotency-Key': z.string().max(256).optional().meta({
    description:
      'At most 256 characters, kept 24 h per connection: the same key and body replay the stored response, another body answers 409 `idempotency_mismatch`.',
  }),
})
