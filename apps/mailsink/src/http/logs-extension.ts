import type { ApiDialect } from '@mailsink/contracts'
import {
  type ApiLogEntry,
  isDomainError,
  logBody,
  messageIdsOf,
  redactHeaders,
} from '@mailsink/core'
import { bufferedBodyOf } from './body-limit'
import { clientIp } from './client-ip'
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
 * itself through `log.api` and the UI refetching), on the workspace and the Admin side
 * (D151), and the SSE stream (long-lived).
 */
export function isLoggedCall(method: string, pathname: string): boolean {
  if (dialectOf(pathname) === null) return false
  if (method !== 'GET') return true
  if (pathname.startsWith('/capture/logs') || pathname.startsWith('/admin/logs')) return false
  return pathname !== '/capture/stream'
}

/** Authenticated logged requests whose body is to be logged (anonymous ones never are). */
const wantedBodies = new WeakSet<Request>()

/**
 * The logged request body, read once (D157): the bytes the handler already buffered
 * (limitBody), else the body itself when nothing consumed it (a call refused by rate limit
 * or chaos before parsing). A body cut by the 413 cap is neither, and logs null.
 */
function requestText(request: Request, maxBytes: number): Promise<string | null> {
  if (!wantedBodies.has(request)) return Promise.resolve(null)
  const bytes = bufferedBodyOf(request)
  if (bytes)
    return Promise.resolve(bytes.byteLength > 0 ? Buffer.from(bytes).toString('utf8') : null)
  if (request.bodyUsed || !request.body) return Promise.resolve(null)
  return readCapped(request.body, maxBytes)
}

type ResponseCtx = Parameters<NonNullable<ApiExtension['onResponse']>>[0]

function errorCodeOf(error: unknown): string | null {
  if (!error) return null
  return isDomainError(error) ? error.code : 'internal_error'
}

async function buildEntry(
  ctx: ResponseCtx,
  dialect: ApiDialect,
  bodies: { request: Promise<string | null>; response: Promise<string | null> },
  response: Response,
  error: unknown,
  durationMs: number,
): Promise<ApiLogEntry> {
  const { request, auth } = ctx
  const url = new URL(request.url)
  const [requestBody, responseText] = await Promise.all([bodies.request, bodies.response])
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
    responseHeaders: redactHeaders(response.headers),
    requestBody: logBody(requestBody),
    responseBody: logBody(responseText),
    messageIds: INGESTION.has(dialect) ? messageIdsOf(parseJson(responseText)) : [],
    errorCode: errorCodeOf(error),
    ip: clientIp(request, ctx.runtime.config.trustProxy === true),
  }
}

/**
 * Request log (#35, D145 to D147): one `api_logs` row per call of a logged surface,
 * refused ones included (`rate_limited`, `chaos_injected`, auth failures). Runs first among
 * the extensions: its `afterAuth` marks the body as wanted (only once the caller is
 * authenticated, so anonymous bodies are never read), its `onResponse` takes the request
 * body without a second read (requestText), clones a JSON response and hands the row to
 * `runtime.logs`, which writes it after the response left. Nothing here can fail or delay
 * the call beyond the response clone.
 */
export const requestLogExtension: ApiExtension = {
  name: 'request-log',
  afterAuth: ({ request }: RequestContext) => {
    const { pathname } = new URL(request.url)
    if (!isLoggedCall(request.method, pathname) || !request.body) return
    if (!isLoggableType(request.headers.get('content-type'))) return
    wantedBodies.add(request)
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
    const bodies = {
      request: requestText(ctx.request, ctx.runtime.config.maxMessageBytes),
      response: text,
    }
    ctx.runtime.logs.writeApiLog(buildEntry(ctx, dialect, bodies, response, error, durationMs))
  },
}
