import { DomainError } from '../../errors'
import type { IdempotencyPolicy } from '../../ingestion/idempotency'

// Brevo idempotency as Brevo documents it (developers.brevo.com, « Idempotency for batch
// emails », checked on 24/11/2026; owner decision D279): an `idempotencyKey` entry of the
// `headers` body field, a UUID, kept 30 minutes; any reuse within that window, same body or
// not, is refused with `duplicate_parameter` and the request is not processed.

/** Brevo's TTL of an `idempotencyKey`. */
export const BREVO_IDEMPOTENCY_TTL_MS = 30 * 60 * 1000

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The `idempotencyKey` entry of the Brevo `headers` field (any case: Brevo's guide writes
 * `idempotencyKey`, its send reference `IdempotencyKey`), undefined when absent. A key that
 * is not a UUID is a 400 on `headers.<name>`.
 */
export function readBrevoIdempotencyKey(
  headers: Record<string, string> | undefined,
): string | undefined {
  const entry = Object.entries(headers ?? {}).find(
    ([name]) => name.toLowerCase() === 'idempotencykey',
  )
  if (!entry) return undefined
  const [name, raw] = entry
  const key = raw.trim()
  if (!UUID_RE.test(key)) {
    const message = `${name} must be a UUID`
    throw new DomainError('validation_error', message, {
      status: 400,
      details: {
        in: 'body',
        issues: [
          {
            path: ['headers', name],
            code: 'custom',
            message,
            params: { code: 'invalid_idempotency_key' },
          },
        ],
      },
    })
  }
  return key
}

/** The refusing policy of a Brevo key (D279). */
export function brevoIdempotencyPolicy(key: string): IdempotencyPolicy {
  return {
    ttlMs: BREVO_IDEMPOTENCY_TTL_MS,
    reuse: 'refuse',
    reusedMessage: `Request already processed: idempotencyKey ${key} was used in the last 30 minutes`,
  }
}

/** Stored key: a Brevo account is one connection, so keys never meet another dialect's. */
export const brevoStoredKey = (connectionId: string | null, key: string): string =>
  `brevo:${connectionId ?? ''}:${key.toLowerCase()}`
