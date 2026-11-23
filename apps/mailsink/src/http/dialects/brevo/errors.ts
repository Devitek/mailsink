import type { ApiError, BrevoError, BrevoErrorCode, ErrorCode } from '@mailsink/contracts'
import { DomainError, isDomainError } from '@mailsink/core'
import type { ErrorFormatter } from '../../errors'
import type { ValidationDetails, ValidationIssue } from '../../validation'

// Brevo error bodies (#29): `{ code, message }` with Brevo's codes, from the stable codes of
// core/errors.ts. Statuses stay those of the domain error, except validation (400, below).

const BY_CODE: Record<ErrorCode, BrevoErrorCode> = {
  unauthorized: 'unauthorized',
  forbidden: 'permission_denied',
  validation_error: 'invalid_parameter', // refined by validationCode()
  not_found: 'document_not_found',
  conflict: 'duplicate_parameter',
  idempotency_mismatch: 'duplicate_request',
  rate_limited: 'too_many_requests',
  payload_too_large: 'out_of_range',
  chaos_injected: 'chaos_injected',
  wait_timeout: 'internal_error',
  internal_error: 'internal_error',
}

const issuesOf = (error: ApiError): ValidationIssue[] =>
  (error.details as Partial<ValidationDetails> | undefined)?.issues ?? []

/** `missing_parameter` for an absent field, `out_of_range` for a bound, else `invalid_parameter`. */
function validationCode(issue: ValidationIssue | undefined): BrevoErrorCode {
  if (!issue) return 'invalid_parameter'
  const stable = issue.params?.code
  if (stable?.endsWith('_required')) return 'missing_parameter'
  if (stable === 'too_many_recipients') return 'out_of_range'
  if (issue.code === 'invalid_type' && /received undefined/.test(issue.message)) {
    return 'missing_parameter'
  }
  if (issue.code === 'too_big' || issue.code === 'too_small') return 'out_of_range'
  return 'invalid_parameter'
}

/** Brevo body of an ApiError: the first validation issue names its field in the message. */
export function toBrevoError(error: ApiError): BrevoError {
  if (error.code !== 'validation_error')
    return { code: BY_CODE[error.code], message: error.message }
  const [first] = issuesOf(error)
  const field = first?.path.join('.')
  return {
    code: validationCode(first),
    message: first ? (field ? `${field}: ${first.message}` : first.message) : error.message,
  }
}

export const brevoErrorBody: ErrorFormatter = (error) => toBrevoError(error)

/** Brevo answers every invalid body with 400, never 422. */
export function asBrevoStatus(error: unknown): unknown {
  if (!isDomainError(error) || error.code !== 'validation_error' || error.status === 400) {
    return error
  }
  return new DomainError('validation_error', error.message, {
    status: 400,
    details: error.details,
    headers: error.headers,
  })
}
