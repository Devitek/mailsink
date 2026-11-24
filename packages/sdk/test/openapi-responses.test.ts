// Real answers of a representative set of routes checked against the OpenAPI registry
// (`@mailsink/openapi`): the status is one the document declares for the operation, and a
// JSON body matches the declared schema exactly (no undocumented field, D262).
import { ApiErrorBody } from '@mailsink/contracts'
import { describeDb } from '@mailsink/db/testing'
import { createOpenApiDocument, ROUTES, type RouteSpec } from '@mailsink/openapi'
import { expect, it } from 'vitest'
import { createMailsink, type Mailsink } from '../src'
import { useHarness } from './harness'

interface Exchange {
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

function routeOf(method: string, path: string): RouteSpec {
  const found = MATCHERS.find((m) => m.route.method === method && m.pattern.test(path))
  if (!found) throw new Error(`${method} ${path}: not in the registry`)
  return found.route
}

/** A client of the same options whose answers are recorded in `log`. */
function recording(client: Mailsink, log: Exchange[]): Mailsink {
  const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
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
  return createMailsink({ ...client.options, fetch })
}

describeDb('OpenAPI response schemas', (ctx) => {
  const h = useHarness(ctx)

  it('answers what the registry declares on admin, capture, webhook and log routes', async () => {
    const log: Exchange[] = []
    const admin = recording(h.admin, log)
    const sink = recording(h.sink, log)
    const id = await h.send({ to: 'schema@example.com', subject: 'Schema check' })

    await admin.admin.workspaces.list({ includeEphemeral: true })
    await admin.admin.workspaces.get(h.workspaceId)
    await admin.admin.workspaces.update(h.workspaceId, { description: 'Checked' })
    const template = await admin.admin.templates.create(h.workspaceId, {
      name: 'Acme welcome',
      subject: 'Welcome',
      html: '<p>Welcome</p>',
    })
    await admin.admin.templates.list(h.workspaceId)
    await admin.admin.templates.delete(h.workspaceId, template.externalId)
    await admin.admin.logs.list()

    await sink.messages.list()
    await sink.messages.get(id)
    await sink.messages.waitFor({ to: 'schema@example.com' }, { since: new Date(0) })
    await sink.messages.triggerEvent(id, { type: 'status', status: 'delivered' })
    await sink.overrides.activate({ rules: [{ match: 'x@example.com', status: 'failed' }] })
    await sink.overrides.get()
    await sink.overrides.reset()
    await sink.suppressions.list()
    const endpoint = await sink.webhooks.create({
      connectionId: null,
      url: `${h.server.url}/hook`,
      events: ['email.delivered'],
    })
    await sink.webhooks.list()
    await sink.webhooks.preview({ payloadFormat: 'resend', event: 'email.delivered' })
    const delivery = await sink.webhooks.test(endpoint.id)
    await sink.webhooks.deliveries.list()
    await sink.webhooks.deliveries.get(delivery.id)
    await sink.webhooks.delete(endpoint.id)
    await sink.logs.api.list()
    await sink.logs.smtp.list()
    await sink.messages.get('msg_unknown').catch(() => undefined)
    await admin.admin.workspaces.create({ name: '' }).catch(() => undefined)
    await sink.messages.purge()

    const document = createOpenApiDocument()
    const failures: string[] = []
    for (const exchange of log) {
      const route = routeOf(exchange.method, exchange.path)
      const name = `${exchange.method.toUpperCase()} ${route.path} ${exchange.status}`
      const declared = document.paths?.[route.path]?.[route.method]?.responses ?? {}
      if (!(String(exchange.status) in declared)) failures.push(`${name}: status not declared`)
      const success = route.success.find((s) => s.status === exchange.status)
      const schema = exchange.status >= 400 ? ApiErrorBody : success?.schema
      if (!schema || exchange.body === undefined) continue
      const parsed = schema.safeParse(exchange.body)
      if (!parsed.success) failures.push(`${name}: ${parsed.error.message}`)
      else if (JSON.stringify(sorted(parsed.data)) !== JSON.stringify(sorted(exchange.body)))
        failures.push(`${name}: fields outside the declared schema`)
    }
    expect(failures).toEqual([])
    const covered = new Set(log.map((e) => `${e.method} ${routeOf(e.method, e.path).path}`))
    expect(covered.size).toBeGreaterThanOrEqual(25)
    expect(log.some((e) => e.status === 404) && log.some((e) => e.status === 422)).toBe(true)
  })
})

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
