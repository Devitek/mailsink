import { ApiErrorBody, BrevoError, type ErrorCode, ResendErrorBody } from '@mailsink/contracts'
import { z } from 'zod'
import type { ZodOpenApiResponseObject } from 'zod-openapi'
import { REQUEST_ID, RETRY_AFTER, rateLimitHeaders, WWW_AUTHENTICATE } from './headers'
import type { ErrorDialect, RouteSpec } from './route'

/** HTTP status of each stable code (D40, `core/errors.ts`). */
const STATUS: Record<ErrorCode, number> = {
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

/** Statuses a chaos failure is drawn from (`chaos.httpCodes`, D93). */
const CHAOS_STATUSES = [429, 500, 502, 503]

const BODY: Record<ErrorDialect, z.ZodType> = {
  native: ApiErrorBody,
  resend: ResendErrorBody,
  brevo: BrevoError,
}

/** Codes a route may answer: implied by its auth and inputs, plus its explicit ones. */
function codesOf(route: RouteSpec): ErrorCode[] {
  const codes: ErrorCode[] = []
  if (route.auth !== 'none') codes.push('unauthorized', 'forbidden')
  if (route.params) codes.push('not_found')
  if (route.params || route.query || route.body || route.auth === 'workspace') {
    codes.push('validation_error')
  }
  if (route.body) codes.push('payload_too_large')
  if (route.ingestion) codes.push('idempotency_mismatch', 'rate_limited', 'chaos_injected')
  codes.push(...(route.errors ?? []), 'internal_error')
  return [...new Set(codes)]
}

/** Statuses of one code on this route, dialect and call site overrides included. */
function statusesOf(code: ErrorCode, route: RouteSpec): number[] {
  const dialect = route.errorDialect ?? 'native'
  if (code === 'chaos_injected') return CHAOS_STATUSES
  if (dialect === 'brevo' && code === 'idempotency_mismatch') return [400] // D279
  if (code === 'validation_error') {
    if (dialect === 'brevo') return [400]
    // 400: an unreadable JSON body, or the Admin key without X-Mailsink-Workspace.
    const unreadable = route.body !== undefined || route.auth === 'workspace'
    const invalid = route.params || route.query || route.body
    return [...(unreadable ? [400] : []), ...(invalid ? [422] : [])]
  }
  // Resend: an unknown key is `400 validation_error` on every endpoint but sending (D158).
  if (code === 'unauthorized' && dialect === 'resend' && route.method === 'get') return [400, 401]
  return [STATUS[code]]
}

/** Status to the codes answered with it, statuses ascending. */
export function errorStatuses(route: RouteSpec): Map<number, ErrorCode[]> {
  const byStatus = new Map<number, ErrorCode[]>()
  for (const code of codesOf(route)) {
    for (const status of statusesOf(code, route)) {
      byStatus.set(status, [...(byStatus.get(status) ?? []), code])
    }
  }
  return new Map([...byStatus].sort(([a], [b]) => a - b))
}

function headersOf(route: RouteSpec, status: number) {
  return z.object({
    ...REQUEST_ID,
    ...(status === 401 ? WWW_AUTHENTICATE : {}),
    ...(status === 429 ? RETRY_AFTER : {}),
    ...(route.ingestion ? rateLimitHeaders(route.errorDialect ?? 'native') : {}),
  })
}

/** OpenAPI error responses of a route, keyed by status. */
export function errorResponses(route: RouteSpec): Record<string, ZodOpenApiResponseObject> {
  const body = BODY[route.errorDialect ?? 'native']
  const responses: Record<string, ZodOpenApiResponseObject> = {}
  for (const [status, codes] of errorStatuses(route)) {
    responses[String(status)] = {
      description: `Error: ${codes.map((code) => `\`${code}\``).join(', ')}`,
      headers: headersOf(route, status),
      content: { 'application/json': { schema: body } },
    }
  }
  return responses
}
