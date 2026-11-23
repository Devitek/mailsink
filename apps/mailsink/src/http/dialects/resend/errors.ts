import {
  type ApiError,
  type ErrorCode,
  type ResendErrorBody,
  ResendErrorName,
} from '@mailsink/contracts'
import type { ErrorFormatter } from '../../errors'

/** Resend name of each stable Mailsink code (03-contracts, « Resend dialect », D122). */
const NAMES: Record<ErrorCode, ResendErrorName> = {
  unauthorized: 'validation_error',
  forbidden: 'restricted_api_key',
  validation_error: 'validation_error',
  not_found: 'not_found',
  conflict: 'validation_error',
  idempotency_mismatch: 'invalid_idempotent_request',
  rate_limited: 'rate_limit_exceeded',
  payload_too_large: 'validation_error',
  chaos_injected: 'application_error',
  wait_timeout: 'application_error',
  internal_error: 'application_error',
}

/** Resend's own wording where Mailsink's message would not match it. */
const MESSAGES: Partial<Record<ErrorCode, string>> = {
  unauthorized: 'API key is invalid',
  idempotency_mismatch:
    "This idempotency key has been used with this HTTP method and endpoint within the last 24 hours, but the request body was modified and doesn't match the original request.",
  internal_error: 'An unexpected error occurred.',
}

/** `details.resend` set by the dialect (`resendError` of @mailsink/core), if any. */
function explicitName(details: unknown): ResendErrorName | undefined {
  if (!details || typeof details !== 'object' || !('resend' in details)) return undefined
  const parsed = ResendErrorName.safeParse(details.resend)
  return parsed.success ? parsed.data : undefined
}

/** A request without any credential (`details.credential` set by the shared auth). */
const missingKey = (error: ApiError) =>
  error.code === 'unauthorized' &&
  (error.details as { credential?: unknown } | undefined)?.credential === 'missing'

function nameOf(error: ApiError, status: number): ResendErrorName {
  const explicit = explicitName(error.details)
  if (explicit) return explicit
  if (missingKey(error)) return 'missing_api_key'
  if (error.code === 'chaos_injected') {
    if (status === 429) return 'rate_limit_exceeded'
    if (status === 503) return 'service_unavailable'
  }
  return NAMES[error.code]
}

/**
 * Error body of the Resend dialect: `{ statusCode, name, message }`, never `details`.
 * A missing key is `401 missing_api_key`; an unknown key is `400 validation_error` on every
 * endpoint but sending, which keeps 401 (Resend errors reference, D158).
 */
export const resendErrorBody: ErrorFormatter = Object.assign(
  (error: ApiError, { status }: { status: number }) =>
    ({
      statusCode: status,
      name: nameOf(error, status),
      message: missingKey(error) ? 'Missing API Key' : (MESSAGES[error.code] ?? error.message),
    }) satisfies ResendErrorBody,
  {
    status: (error: ApiError, { status, method }: { status: number; method: string }) =>
      error.code === 'unauthorized' && !missingKey(error) && method === 'GET' ? 400 : status,
  },
)
