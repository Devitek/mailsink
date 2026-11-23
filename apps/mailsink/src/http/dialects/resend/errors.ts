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

function nameOf(error: ApiError, status: number): ResendErrorName {
  const explicit = explicitName(error.details)
  if (explicit) return explicit
  if (error.code === 'chaos_injected') {
    if (status === 429) return 'rate_limit_exceeded'
    if (status === 503) return 'service_unavailable'
  }
  return NAMES[error.code]
}

/** Error body of the Resend dialect: `{ statusCode, name, message }`, never `details`. */
export const resendErrorBody: ErrorFormatter = (error, { status }) =>
  ({
    statusCode: status,
    name: nameOf(error, status),
    message: MESSAGES[error.code] ?? error.message,
  }) satisfies ResendErrorBody
