import type { ErrorCode } from '@mailsink/contracts'

/** Default HTTP status of each error code (native, capture and admin APIs). */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  validation_error: 422,
  not_found: 404,
  conflict: 409,
  idempotency_mismatch: 409,
  rate_limited: 429,
  payload_too_large: 413,
  chaos_injected: 500,
  wait_timeout: 408,
  internal_error: 500,
}

export interface DomainErrorOptions {
  details?: unknown
  /** Overrides the default status of the code (e.g. 400 for an unreadable body). */
  status?: number
  /** Extra response headers (e.g. `Retry-After` on `rate_limited`). */
  headers?: Record<string, string>
}

/**
 * Expected failure of a domain operation: a stable code and an English message (D19),
 * safe to show to the caller. Anything else thrown is reported as `internal_error`.
 */
export class DomainError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly details: unknown
  readonly headers: Record<string, string>

  constructor(code: ErrorCode, message: string, options: DomainErrorOptions = {}) {
    super(message)
    this.name = 'DomainError'
    this.code = code
    this.status = options.status ?? ERROR_STATUS[code]
    this.details = options.details
    this.headers = options.headers ?? {}
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError
}
