import type { ErrorCode } from '@mailsink/contracts'

/**
 * Stable error codes: the server codes of D40 (`ErrorCode`), plus the client-side ones:
 * `network_error` (the request never got an answer) and `invalid_response` (an answer the
 * SDK cannot read, or one that fails the optional response validation).
 */
export type MailsinkErrorCode = ErrorCode | 'network_error' | 'invalid_response'

export interface MailsinkErrorInit {
  code: MailsinkErrorCode
  message: string
  /** HTTP status, `null` when no answer came back. */
  status?: number | null
  /** `X-Request-Id` of the call, to find it in the request log. */
  requestId?: string | null
  details?: unknown
  cause?: unknown
}

/** Every failure of the SDK. `code` is stable; `message` is English and may change. */
export class MailsinkError extends Error {
  override readonly name = 'MailsinkError'
  readonly code: MailsinkErrorCode
  readonly status: number | null
  readonly requestId: string | null
  readonly details: unknown

  constructor(init: MailsinkErrorInit) {
    super(init.message, init.cause === undefined ? undefined : { cause: init.cause })
    this.code = init.code
    this.status = init.status ?? null
    this.requestId = init.requestId ?? null
    this.details = init.details
  }
}

/** Narrows an unknown error, optionally to one code: `isMailsinkError(e, 'wait_timeout')`. */
export function isMailsinkError(error: unknown, code?: MailsinkErrorCode): error is MailsinkError {
  return error instanceof MailsinkError && (code === undefined || error.code === code)
}

// D40, read backwards: the code of an error answer whose body is not the contract shape
// (a reverse proxy page, an empty body).
const CODE_BY_STATUS: Record<number, ErrorCode> = {
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  408: 'wait_timeout',
  409: 'conflict',
  413: 'payload_too_large',
  422: 'validation_error',
  429: 'rate_limited',
}

export const codeForStatus = (status: number): ErrorCode =>
  CODE_BY_STATUS[status] ?? 'internal_error'
