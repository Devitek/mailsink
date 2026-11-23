import { newId } from '@mailsink/db'
import type { z } from 'zod'
import type { Runtime } from '../runtime/container'
import { whenRuntimeReady } from '../runtime/slot'
import { type AuthFor, type AuthMode, authenticate } from './auth'
import { type BodyCap, limitBody, resolveBodyCap } from './body-limit'
import { type ErrorFormatter, errorResponse, REQUEST_ID_HEADER } from './errors'
import { type ApiExtension, DEFAULT_EXTENSIONS } from './extensions'
import { parseInput, queryObject, readJsonBody } from './validation'

type Out<S> = S extends z.ZodType ? z.output<S> : undefined

export interface ApiContext<M extends AuthMode, B, Q, P> {
  request: Request
  requestId: string
  runtime: Runtime
  auth: AuthFor<M>
  body: Out<B>
  query: Out<Q>
  params: Out<P>
}

export interface ApiSpec<M extends AuthMode, B, Q, P> {
  auth: M
  body?: B
  query?: Q
  params?: P
  /** Error body shape of the dialect, native by default. */
  errorFormat?: ErrorFormatter
  /**
   * Body size cap (`payload_too_large`): bytes, or `'message'` for
   * `MAILSINK_MAX_MESSAGE_BYTES` (ingestion). `DEFAULT_MAX_BODY_BYTES` (1 MiB) by default.
   */
  maxBodyBytes?: BodyCap
  /** Route-specific extensions, run after DEFAULT_EXTENSIONS. */
  extensions?: readonly ApiExtension[]
  /** A plain value is sent as JSON 200; return a Response for anything else. */
  handler: (ctx: ApiContext<M, B, Q, P>) => unknown
}

/** What a TanStack Start server route handler receives (the part defineApi uses). */
export type RouteInput = { request: Request; params?: Record<string, string> }

/**
 * Server route adapter shared by every HTTP surface: authenticate, run the extensions,
 * parse params, query and body with Zod, call the handler, answer errors in the contract
 * shape. Every response carries `X-Request-Id`.
 */
export function defineApi<
  M extends AuthMode,
  B extends z.ZodType | undefined = undefined,
  Q extends z.ZodType | undefined = undefined,
  P extends z.ZodType | undefined = undefined,
>(spec: ApiSpec<M, B, Q, P>): (input: RouteInput) => Promise<Response> {
  const extensions = [...DEFAULT_EXTENSIONS, ...(spec.extensions ?? [])]
  return async ({ request, params }) => {
    const requestId = newId('req')
    const startedAt = performance.now()
    let runtime: Runtime | undefined
    let auth: AuthFor<M> | undefined
    let response: Response
    let failure: unknown
    try {
      runtime = await whenRuntimeReady()
      auth = await authenticate(request, spec.auth, {
        db: runtime.db.db,
        adminKey: runtime.config.adminKey,
      })
      const ctx = { request, requestId, runtime, auth, startedAt }
      for (const ext of extensions) await ext.afterAuth?.(ctx)
      const input = {
        params: await parse(spec.params, params ?? {}, 'params'),
        query: await parse(spec.query, queryObject(new URL(request.url)), 'query'),
        body: spec.body
          ? await parse(
              spec.body,
              await readJsonBody(
                await limitBody(
                  request,
                  resolveBodyCap(spec.maxBodyBytes, runtime.config.maxMessageBytes),
                ),
              ),
              'body',
            )
          : undefined,
      } as Pick<ApiContext<M, B, Q, P>, 'params' | 'query' | 'body'>
      const result = await spec.handler({ request, requestId, runtime, auth, ...input })
      response = withRequestId(
        result instanceof Response ? result : Response.json(result ?? null),
        requestId,
      )
    } catch (error) {
      failure = error
      response = errorResponse(error, {
        requestId,
        format: spec.errorFormat,
        method: request.method,
      })
    }
    if (runtime)
      await runOnResponse(
        extensions,
        { request, requestId, runtime, auth, startedAt },
        response,
        failure,
      )
    return response
  }
}

/** Sets the request id, copying responses whose headers are immutable (e.g. redirects). */
function withRequestId(response: Response, requestId: string): Response {
  try {
    response.headers.set(REQUEST_ID_HEADER, requestId)
    return response
  } catch {
    const copy = new Response(response.body, response)
    copy.headers.set(REQUEST_ID_HEADER, requestId)
    return copy
  }
}

function parse(schema: z.ZodType | undefined, value: unknown, source: 'params' | 'query' | 'body') {
  return schema ? parseInput(schema, value, source) : Promise.resolve(undefined)
}

async function runOnResponse(
  extensions: readonly ApiExtension[],
  ctx: Parameters<NonNullable<ApiExtension['onResponse']>>[0],
  response: Response,
  error: unknown,
): Promise<void> {
  for (const ext of extensions) {
    try {
      await ext.onResponse?.(ctx, response, error)
    } catch (hookError) {
      console.error(`[mailsink] extension ${ext.name} failed on ${ctx.requestId}`, hookError)
    }
  }
}
