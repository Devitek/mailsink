import type { ApiError, ApiErrorBody } from '@mailsink/contracts'
import { isDomainError } from '@mailsink/core'

export const REQUEST_ID_HEADER = 'X-Request-Id'

/**
 * Shapes an error body for one dialect. The native, capture and admin APIs use
 * `nativeErrorBody`; the Resend and Brevo dialects plug their own (#28, #29).
 */
export type ErrorFormatter = (
  error: ApiError,
  context: { requestId: string; status: number },
) => unknown

/** `{ error: { code, message, details? }, requestId }` (03-contracts, « Errors »). */
export const nativeErrorBody: ErrorFormatter = (error, { requestId }) =>
  ({ error, requestId }) satisfies ApiErrorBody

export interface ErrorResponseOptions {
  requestId: string
  format?: ErrorFormatter
  log?: Pick<Console, 'error'>
}

/**
 * Turns anything thrown by a handler into a response. A DomainError keeps its code, message
 * and details; anything else is logged server-side and answered as a bare 500
 * `internal_error`, so no stack, SQL or secret ever reaches the caller.
 */
export function errorResponse(error: unknown, options: ErrorResponseOptions): Response {
  const { requestId, format = nativeErrorBody, log = console } = options
  let status = 500
  let apiError: ApiError = { code: 'internal_error', message: 'Internal server error' }
  let headers: Record<string, string> = {}
  if (isDomainError(error)) {
    status = error.status
    headers = error.headers
    apiError = { code: error.code, message: error.message }
    if (error.details !== undefined) apiError.details = error.details
  } else {
    log.error(`[mailsink] request ${requestId} failed`, error)
  }
  return Response.json(format(apiError, { requestId, status }), {
    status,
    headers: { ...headers, [REQUEST_ID_HEADER]: requestId },
  })
}
