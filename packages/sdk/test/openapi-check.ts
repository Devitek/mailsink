// Shared checker of the OpenAPI response tests (D262): real answers recorded through a
// `fetch` wrapper, then checked against the registry (`@mailsink/openapi`). The status must
// be declared for the operation and a JSON body must match the declared schema exactly.
import { ApiErrorBody, BrevoError, ResendErrorBody } from '@mailsink/contracts'
import { createOpenApiDocument, ROUTES, type RouteSpec } from '@mailsink/openapi'
import type { z } from 'zod'

export interface Exchange {
  method: string
  path: string
  status: number
  body: unknown
}

/** Most specific first: `/capture/webhooks/deliveries` before `/capture/webhooks/{id}`. */
const MATCHERS = ROUTES.map((route) => ({
  route,
  params: route.path.split('{').length - 1,
  pattern: new RegExp(`^${route.path.replace(/\{\w+\}/g, '[^/]+')}$`),
})).sort((a, b) => a.params - b.params)

export function routeOf(method: string, path: string): RouteSpec {
  const found = MATCHERS.find((m) => m.route.method === method && m.pattern.test(path))
  if (!found) throw new Error(`${method} ${path}: not in the registry`)
  return found.route
}

/** A `fetch` that records every answer in `log`. */
export function recordingFetch(log: Exchange[]): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await globalThis.fetch(input, init)
    const url = new URL(String(input))
    const json = response.headers.get('content-type')?.includes('application/json')
    log.push({
      method: (init?.method ?? 'GET').toLowerCase(),
      path: url.pathname,
      status: response.status,
      body: json ? await response.clone().json() : undefined,
    })
    return response
  }
}

const ERROR_BODY: Record<NonNullable<RouteSpec['errorDialect']>, z.ZodType> = {
  native: ApiErrorBody,
  resend: ResendErrorBody,
  brevo: BrevoError,
}

/** The failures of the recorded exchanges, one line each (empty when all conform). */
export function checkExchanges(log: readonly Exchange[]): string[] {
  const document = createOpenApiDocument()
  const failures: string[] = []
  for (const exchange of log) {
    const route = routeOf(exchange.method, exchange.path)
    const name = `${exchange.method.toUpperCase()} ${route.path} ${exchange.status}`
    const declared = document.paths?.[route.path]?.[route.method]?.responses ?? {}
    if (!(String(exchange.status) in declared)) failures.push(`${name}: status not declared`)
    const success = route.success.find((s) => s.status === exchange.status)
    const schema =
      exchange.status >= 400 ? ERROR_BODY[route.errorDialect ?? 'native'] : success?.schema
    if (!schema || exchange.body === undefined) continue
    const parsed = schema.safeParse(exchange.body)
    if (!parsed.success) failures.push(`${name}: ${parsed.error.message}`)
    else if (JSON.stringify(sorted(parsed.data)) !== JSON.stringify(sorted(exchange.body)))
      failures.push(`${name}: fields outside the declared schema`)
  }
  return failures
}

/** Same value with object keys sorted, so key order does not count. */
function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sorted(v)]),
    )
  return value
}
