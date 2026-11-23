import type { ApiDialect } from '@mailsink/contracts'
import {
  type ApiLogEntry,
  isDomainError,
  logBody,
  messageIdsOf,
  redactHeaders,
} from '@mailsink/core'
import type { ApiExtension, RequestContext } from './extensions'
import { isLoggableType, parseJson, readCapped } from './logs-body'

/** Responses larger than this are logged without body. */
export const LOG_RESPONSE_READ_MAX_BYTES = 1_048_576

const INGESTION: ReadonlySet<ApiDialect> = new Set(['native', 'resend', 'brevo'])

/** The surface a path belongs to (03-contracts route map), null for an unlogged route. */
export function dialectOf(pathname: string): ApiDialect | null {
  if (pathname.startsWith('/v1/')) return 'native'
  if (pathname === '/emails' || pathname.startsWith('/emails/')) return 'resend'
  if (pathname.startsWith('/v3/')) return 'brevo'
  if (pathname.startsWith('/admin/') || pathname === '/admin') return 'admin'
  if (pathname.startsWith('/capture/')) return 'capture'
  if (pathname === '/mcp' || pathname.startsWith('/mcp/')) return 'mcp'
  return null
}

/**
 * Calls that are not logged (D145): reading the logs (a log of every log read would feed
 * itself through `log.api` and the UI refetching), and the SSE stream (long-lived).
 */
export function isLoggedCall(method: string, pathname: string): boolean {
  if (dialectOf(pathname) === null) return false
  if (method !== 'GET') return true
  return !pathname.startsWith('/capture/logs') && pathname !== '/capture/stream'
}

/** Request body being read in the background, per request in flight. */
const requestBodies = new WeakMap<Request, Promise<string | null>>()

type ResponseCtx = Parameters<NonNullable<ApiExtension['onResponse']>>[0]

function errorCodeOf(error: unknown): string | null {
  if (!error) return null
  return isDomainError(error) ? error.code : 'internal_error'
}

async function buildEntry(
  ctx: ResponseCtx,
  dialect: ApiDialect,
  response: { status: number; text: Promise<string | null> },
  error: unknown,
  durationMs: number,
): Promise<ApiLogEntry> {
  const { request, auth } = ctx
  const url = new URL(request.url)
  const [requestText, responseText] = await Promise.all([
    requestBodies.get(request) ?? Promise.resolve(null),
    response.text,
  ])
  const workspace = auth?.kind === 'workspace' ? auth : undefined
  return {
    id: ctx.requestId,
    workspaceId: workspace?.workspace.id ?? null,
    connectionId: workspace?.connection?.id ?? null,
    dialect,
    method: request.method,
    path: `${url.pathname}${url.search}`,
    statusCode: response.status,
    durationMs,
    requestHeaders: redactHeaders(request.headers),
    requestBody: logBody(requestText),
    responseBody: logBody(responseText),
    messageIds: INGESTION.has(dialect) ? messageIdsOf(parseJson(responseText)) : [],
    errorCode: errorCodeOf(error),
    ip: (request as Request & { ip?: string }).ip ?? null,
  }
}

/**
 * Request log (#35, D145 to D147): one `api_logs` row per call of a logged surface,
 * refused ones included (`rate_limited`, `chaos_injected`, auth failures). Runs first among
 * the extensions: its `afterAuth` starts reading a clone of the body (only once the
 * caller is authenticated, so anonymous bodies are never read), its `onResponse` clones a
 * JSON response and hands the row to `runtime.logs`, which writes it after the response
 * left. Nothing here can fail or delay the call beyond the clones.
 */
export const requestLogExtension: ApiExtension = {
  name: 'request-log',
  afterAuth: ({ request, runtime }: RequestContext) => {
    const { pathname } = new URL(request.url)
    if (!isLoggedCall(request.method, pathname) || !request.body) return
    if (!isLoggableType(request.headers.get('content-type'))) return
    requestBodies.set(request, readCapped(request.clone().body, runtime.config.maxMessageBytes))
  },
  onResponse: (ctx, response, error) => {
    const { pathname } = new URL(ctx.request.url)
    const dialect = dialectOf(pathname)
    if (!dialect || !isLoggedCall(ctx.request.method, pathname)) return
    const durationMs = Math.max(0, Math.round(performance.now() - ctx.startedAt))
    const text =
      isLoggableType(response.headers.get('content-type')) && response.body
        ? readCapped(response.clone().body, LOG_RESPONSE_READ_MAX_BYTES)
        : Promise.resolve(null)
    ctx.runtime.logs.writeApiLog(
      buildEntry(ctx, dialect, { status: response.status, text }, error, durationMs),
    )
  },
}
