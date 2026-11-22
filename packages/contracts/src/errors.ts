import { z } from 'zod'

/** Error codes of the native, capture and admin APIs. Messages stay English (D19). */
export const ErrorCode = z.enum([
  'unauthorized',
  'forbidden',
  'validation_error',
  'not_found',
  'conflict',
  'idempotency_mismatch',
  'rate_limited',
  'payload_too_large',
  'chaos_injected',
  'wait_timeout',
  'internal_error',
])

export const ApiError = z.object({
  code: ErrorCode,
  message: z.string(),
  details: z.unknown().optional(),
})

/** Error body: `{ error: { code, message, details? }, requestId }`. */
export const ApiErrorBody = z.object({ error: ApiError, requestId: z.string() })

export type ErrorCode = z.output<typeof ErrorCode>
export type ApiError = z.output<typeof ApiError>
export type ApiErrorBody = z.output<typeof ApiErrorBody>
