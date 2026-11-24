import type { z } from 'zod'
import { createServerClock, type ServerClock } from './clock'
import { codeForStatus, MailsinkError } from './errors'
import { type QueryValue, toSearchParams } from './query'

export interface MailsinkOptions {
  /** Base URL of the instance, e.g. `http://localhost:3000` (a path prefix is kept). */
  url: string | URL
  /** Workspace key (`mskw_`) or connection key (`msk_`): every workspace-scoped call. */
  key?: string
  /** Admin key: the `admin.*` calls, and workspace calls together with `workspace`. */
  adminKey?: string
  /** Workspace id or slug, sent as `X-Mailsink-Workspace` (required with the admin key). */
  workspace?: string
  /** `fetch` implementation, the global one by default. */
  fetch?: typeof fetch
  /** Extra headers sent on every call. */
  headers?: HeadersInit
  /** Validate every JSON answer against its contract (off by default). */
  validate?: boolean
}

export type AuthScope = 'admin' | 'workspace'

export interface Call {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  auth: AuthScope
  query?: Record<string, QueryValue>
  body?: unknown
  /** Contract of the answer, used when `validate` is on. */
  schema?: z.ZodType
  signal?: AbortSignal
  headers?: HeadersInit
}

export const REQUEST_ID_HEADER = 'x-request-id'
export const WORKSPACE_HEADER = 'x-mailsink-workspace'

/** Path segment, encoded: `path\`/capture/messages/${id}\``. */
export const seg = (value: string): string => encodeURIComponent(value)

export interface Transport {
  readonly options: Readonly<MailsinkOptions>
  /** Server time estimated from the `Date` header of the answers (D261). */
  readonly clock: ServerClock
  /** The URL of a call, query string included. */
  url(path: string, query?: Record<string, QueryValue>): URL
  /** Authentication and extra headers of a scope. */
  headers(auth: AuthScope, extra?: HeadersInit): Headers
  /** Sends a call; resolves the successful Response, throws `MailsinkError` otherwise. */
  send(call: Call): Promise<Response>
  /** Sends a call and reads its JSON answer (`undefined` for 204). */
  json<T>(call: Call): Promise<T>
}

export function createTransport(
  options: MailsinkOptions,
  clock: ServerClock = createServerClock(),
): Transport {
  const base = new URL(String(options.url))
  if (!base.pathname.endsWith('/')) base.pathname += '/'
  const doFetch = options.fetch ?? ((input, init) => globalThis.fetch(input, init))

  const transport: Transport = {
    options,
    clock,
    url(path, query) {
      const url = new URL(path.replace(/^\//, ''), base)
      if (query) url.search = toSearchParams(query).toString()
      return url
    },
    headers(auth, extra) {
      const headers = new Headers(options.headers)
      for (const [name, value] of new Headers(extra)) headers.set(name, value)
      headers.set('authorization', `Bearer ${credential(options, auth)}`)
      if (options.workspace && auth === 'workspace')
        headers.set(WORKSPACE_HEADER, options.workspace)
      return headers
    },
    async send(call) {
      const headers = transport.headers(call.auth, call.headers)
      let body: string | undefined
      if (call.body !== undefined) {
        headers.set('content-type', 'application/json')
        body = JSON.stringify(call.body)
      }
      let response: Response
      const sentAt = Date.now()
      try {
        response = await doFetch(transport.url(call.path, call.query), {
          method: call.method,
          headers,
          body,
          signal: call.signal,
        })
      } catch (cause) {
        if (call.signal?.aborted) throw call.signal.reason ?? cause
        const message = `${call.method} ${call.path} failed: ${(cause as Error)?.message ?? cause}`
        throw new MailsinkError({ code: 'network_error', message, cause })
      }
      clock.observe(response.headers.get('date'), sentAt, Date.now())
      if (!response.ok) throw await errorFrom(response)
      return response
    },
    async json<T>(call: Call) {
      const response = await transport.send(call)
      const requestId = response.headers.get(REQUEST_ID_HEADER)
      if (response.status === 204) return undefined as T
      let value: unknown
      try {
        value = await response.json()
      } catch (cause) {
        const message = `${call.method} ${call.path}: the answer is not JSON`
        throw new MailsinkError({
          code: 'invalid_response',
          message,
          status: response.status,
          requestId,
          cause,
        })
      }
      if (!options.validate || !call.schema) return value as T
      const parsed = call.schema.safeParse(value)
      if (parsed.success) return parsed.data as T
      throw new MailsinkError({
        code: 'invalid_response',
        message: `${call.method} ${call.path}: the answer does not match its contract`,
        status: response.status,
        requestId,
        details: parsed.error.issues,
      })
    },
  }
  return transport
}

function credential(options: MailsinkOptions, auth: AuthScope): string {
  if (auth === 'admin') {
    if (options.adminKey) return options.adminKey
    throw new MailsinkError({
      code: 'unauthorized',
      message: 'adminKey is required for admin calls',
    })
  }
  if (options.key) return options.key
  if (options.adminKey && options.workspace) return options.adminKey
  throw new MailsinkError({
    code: 'unauthorized',
    message: 'key (or adminKey with workspace) is required for workspace calls',
  })
}

/** Reads an error answer: the contract body `{ error, requestId }` when it is one. */
export async function errorFrom(response: Response): Promise<MailsinkError> {
  let requestId = response.headers.get(REQUEST_ID_HEADER)
  const text = await response.text().catch(() => '')
  let body: {
    error?: { code?: unknown; message?: unknown; details?: unknown }
    requestId?: unknown
  }
  try {
    body = JSON.parse(text)
  } catch {
    body = {}
  }
  const error = body?.error
  if (typeof body?.requestId === 'string') requestId ??= body.requestId
  if (error && typeof error.code === 'string' && typeof error.message === 'string') {
    return new MailsinkError({
      code: error.code as MailsinkError['code'],
      message: error.message,
      status: response.status,
      requestId,
      details: error.details,
    })
  }
  return new MailsinkError({
    code: codeForStatus(response.status),
    message: `HTTP ${response.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
    status: response.status,
    requestId,
  })
}
