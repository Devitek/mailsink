// Public entry point of @mailsink/openapi (03-contracts, « OpenAPI »).
export { createOpenApiDocument, type OpenApiDocument, type OpenApiOptions } from './document'
export { ROUTES, UNDOCUMENTED_ROUTES, type UndocumentedRoute } from './registry'
export { type RouteSpec, toOpenApiPath } from './route'
