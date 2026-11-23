import type { ErrorCode } from '@mailsink/contracts'
import type { z } from 'zod'
import type { ZodObjectInput } from 'zod-openapi'

export type HttpMethod = 'get' | 'post' | 'patch' | 'delete'

/** Who may call the route (D41), rendered as OpenAPI security requirements. */
export type RouteAuth = 'none' | 'admin' | 'workspace' | 'connection' | 'brevo'

/** Error body shape of the route: native `ApiErrorBody`, or the provider dialect one. */
export type ErrorDialect = 'native' | 'resend' | 'brevo'

/** OpenAPI tag of the route, one per HTTP surface. */
export type RouteTag =
  | 'Native ingestion'
  | 'Resend'
  | 'Brevo'
  | 'Admin'
  | 'Capture: messages'
  | 'Capture: settings'
  | 'Capture: webhooks'
  | 'Capture: logs'
  | 'System'

export interface SuccessResponse {
  status: number
  description: string
  /** JSON body schema (output side of the contract). Omitted for an empty body. */
  schema?: z.ZodType
  /** Non JSON body (`text/event-stream`, `message/rfc822`, `*\/*`): described as text. */
  mediaType?: string
}

/**
 * One server route of `apps/mailsink/src/routes` as the OpenAPI document describes it. The
 * registry (`registry.ts`) lists every one; a test compares it with the route files.
 */
export interface RouteSpec {
  operationId: string
  method: HttpMethod
  /** OpenAPI form: `/capture/messages/{id}` for the route `/capture/messages/$id`. */
  path: string
  tag: RouteTag
  summary: string
  description?: string
  auth: RouteAuth
  errorDialect?: ErrorDialect
  params?: ZodObjectInput
  query?: ZodObjectInput
  /** Request headers specific to the route (`Idempotency-Key`, `Last-Event-ID`…). */
  headers?: ZodObjectInput
  body?: z.ZodType
  /** The body may be omitted (`POST …/replay`, `POST …/test`). */
  bodyOptional?: boolean
  success: SuccessResponse[]
  /** Error codes the route may answer besides those implied by auth and inputs. */
  errors?: ErrorCode[]
  /** Ingestion routes: rate limit headers, `429 rate_limited`, chaos statuses (D90). */
  ingestion?: boolean
}

/** `/capture/messages/$id` (TanStack route id) to `/capture/messages/{id}` (OpenAPI). */
export function toOpenApiPath(routePath: string): string {
  return routePath.replace(/\$(\w+)/g, '{$1}')
}
