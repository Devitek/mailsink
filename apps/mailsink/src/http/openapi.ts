// `GET /openapi.json` (03-contracts, « OpenAPI », #124): the OpenAPI 3.1 document of the
// instance, public (D231): it describes routes and holds no data.
import { createOpenApiDocument, type OpenApiDocument } from '@mailsink/openapi'
import { defineApi } from './handler'

let cached: { serverUrl: string; document: OpenApiDocument } | undefined

/** The document for this public URL, built once (the contracts do not change at runtime). */
export function openApiDocumentFor(serverUrl: string): OpenApiDocument {
  if (cached?.serverUrl !== serverUrl) {
    cached = { serverUrl, document: createOpenApiDocument({ serverUrl }) }
  }
  return cached.document
}

/** GET /openapi.json: no credential; any origin may read it (Swagger UI, editors). */
export const getOpenApi = defineApi({
  auth: 'none',
  handler: ({ runtime }) =>
    Response.json(openApiDocumentFor(runtime.config.publicUrl), {
      headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300' },
    }),
})
