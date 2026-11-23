import * as contracts from '@mailsink/contracts'
import { MAILSINK_VERSION } from '@mailsink/contracts'
import { z } from 'zod'
import { createDocument, createSchema, type ZodOpenApiPathsObject } from 'zod-openapi'
import { toOperation } from './operation'
import { pruneSchemas } from './prune'
import { ROUTES } from './registry'
import type { RouteSpec, RouteTag } from './route'
import { Health } from './routes/system'
import { SECURITY_SCHEMES } from './security'
import { OUTGOING_WEBHOOKS } from './webhooks'

export type OpenApiDocument = ReturnType<typeof createDocument>

export interface OpenApiOptions {
  /** `servers[0].url`: the instance's `MAILSINK_PUBLIC_URL`, else the local default. */
  serverUrl?: string
}

/** Contract export name of each schema, so components keep the names of the code. */
const NAMES = new Map<unknown, string>(
  Object.entries(contracts)
    .filter(([, value]) => value instanceof z.ZodType)
    .map(([name, schema]) => [schema, name]),
)

/**
 * zod-openapi renders a named component in both directions; a request schema with a
 * transform has no output form, so it stays inline in its operation instead.
 */
function bothWays(schema: z.ZodType): boolean {
  try {
    createSchema(schema, { io: 'output' })
    return true
  } catch {
    return false
  }
}

/** Named components: every contract schema a route uses at its top level, plus extras. */
function schemaComponents(routes: readonly RouteSpec[]): Record<string, z.ZodType> {
  const used = routes.flatMap((route) => [route.body, ...route.success.map((s) => s.schema)])
  const extras = [
    contracts.ApiErrorBody,
    contracts.ResendErrorBody,
    contracts.BrevoError,
    contracts.StreamEvent,
  ]
  const components: Record<string, z.ZodType> = { Health }
  for (const schema of [...used, ...extras]) {
    const name = schema && NAMES.get(schema)
    if (schema && name && bothWays(schema)) components[name] = schema
  }
  return components
}

function paths(routes: readonly RouteSpec[]): ZodOpenApiPathsObject {
  const result: ZodOpenApiPathsObject = {}
  for (const route of routes) {
    result[route.path] = { ...result[route.path], [route.method]: toOperation(route) }
  }
  return result
}

const TAGS: Record<RouteTag | 'Outgoing webhooks', string> = {
  'Native ingestion': 'Native sending API (`/v1`), any connection key.',
  Resend: 'Resend drop-in: point the Resend SDK at Mailsink with a `resend` connection key.',
  Brevo: 'Brevo drop-in: point the Brevo SDK at Mailsink with a `brevo` connection key.',
  Admin: 'Workspaces, connections, templates and logs without workspace: Admin key only.',
  'Capture: messages': 'Captured messages, manual events, demo data and the live stream.',
  'Capture: settings': 'Override (simulation, rate limit, chaos) and suppression list.',
  'Capture: webhooks': 'Webhook endpoints, delivery log and replay.',
  'Capture: logs': 'API request log and SMTP sessions of the workspace.',
  System: 'Public routes: health and this document.',
  'Outgoing webhooks': 'Requests Mailsink sends to your webhook endpoints.',
}

const DESCRIPTION = [
  'Mailsink, a self-hosted email sink: native, Resend and Brevo compatible ingestion,',
  'Capture API, Admin API. Generated from the Zod contracts of `@mailsink/contracts`.',
  'Errors use `{ error: { code, message, details? }, requestId }` (Resend and Brevo routes',
  'answer in their provider shape); statuses follow D40 of the architecture decision log.',
].join(' ')

/** The OpenAPI 3.1 document of every documented HTTP route (`registry.ts`). */
export function createOpenApiDocument(options: OpenApiOptions = {}): OpenApiDocument {
  const document = createDocument({
    openapi: '3.1.0',
    info: {
      title: 'Mailsink',
      version: MAILSINK_VERSION,
      description: DESCRIPTION,
      license: { name: 'MIT', identifier: 'MIT' },
    },
    servers: [{ url: options.serverUrl ?? 'http://localhost:3000' }],
    tags: Object.entries(TAGS).map(([name, description]) => ({ name, description })),
    paths: paths(ROUTES),
    webhooks: OUTGOING_WEBHOOKS,
    components: {
      securitySchemes: SECURITY_SCHEMES,
      schemas: schemaComponents(ROUTES),
    },
  })
  // StreamEvent is named by the stream description, not referenced by a `$ref`.
  return pruneSchemas(document, ['StreamEvent'])
}
