import { z } from 'zod'
import type {
  ZodOpenApiOperationObject,
  ZodOpenApiParameters,
  ZodOpenApiResponseObject,
} from 'zod-openapi'
import { errorResponses } from './errors'
import { IDEMPOTENT_REPLAYED, REQUEST_ID, rateLimitHeaders } from './headers'
import type { RouteSpec, SuccessResponse } from './route'
import { securityOf } from './security'

function successResponse(route: RouteSpec, success: SuccessResponse): ZodOpenApiResponseObject {
  const headers = z.object({
    ...REQUEST_ID,
    ...(route.ingestion
      ? { ...rateLimitHeaders(route.errorDialect ?? 'native'), ...IDEMPOTENT_REPLAYED }
      : {}),
  })
  if (success.schema) {
    return {
      description: success.description,
      headers,
      content: { 'application/json': { schema: success.schema } },
    }
  }
  if (success.mediaType) {
    return {
      description: success.description,
      headers,
      content: { [success.mediaType]: { schema: { type: 'string' } } },
    }
  }
  return { description: success.description, headers }
}

function requestParams(route: RouteSpec): ZodOpenApiParameters | undefined {
  const params: ZodOpenApiParameters = {}
  if (route.params) params.path = route.params
  if (route.query) params.query = route.query
  if (route.headers) params.header = route.headers
  return Object.keys(params).length > 0 ? params : undefined
}

/** The OpenAPI operation of a registry entry: inputs, success, errors (D40), security. */
export function toOperation(route: RouteSpec): ZodOpenApiOperationObject {
  const responses: Record<string, ZodOpenApiResponseObject> = {}
  for (const success of route.success) {
    responses[String(success.status)] = successResponse(route, success)
  }
  return {
    operationId: route.operationId,
    tags: [route.tag],
    summary: route.summary,
    ...(route.description ? { description: route.description } : {}),
    ...(requestParams(route) ? { requestParams: requestParams(route) } : {}),
    ...(route.body
      ? {
          requestBody: {
            required: !route.bodyOptional,
            content: { 'application/json': { schema: route.body } },
          },
        }
      : {}),
    responses: { ...responses, ...errorResponses(route) },
    security: securityOf(route.auth),
  }
}
