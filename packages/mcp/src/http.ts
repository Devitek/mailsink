// Stateless Streamable HTTP (D165): one McpServer and one web-standard transport per POST,
// no session id. Framework-free (Request in, Response out) so the app route and the tests
// share it.
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/server'
import type { McpContext } from './context'
import { createMailsinkMcpServer } from './server'

/** Delay granted to the calls in flight once their workspace is deleted. */
export const DELETED_GRACE_MS = 1000

export interface McpHttpOptions {
  /** Cap of the JSON-RPC body, in bytes (the transport answers 413 past it). */
  maxBodyBytes?: number
  /** `DELETED_GRACE_MS` by default. */
  deletedGraceMs?: number
}

/**
 * A stateless server has no standalone stream to open (GET) nor session to end (DELETE):
 * the specification lets it answer 405 to both.
 */
function methodNotAllowed(): Response {
  return Response.json(
    { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null },
    { status: 405, headers: { Allow: 'POST' } },
  )
}

/** Calls `onEnd` once the body is fully read or cancelled (or at once without a body). */
function whenBodyEnds(response: Response, onEnd: () => void): Response {
  if (!response.body) {
    onEnd()
    return response
  }
  const reader = response.body.getReader()
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read()
        if (done) {
          controller.close()
          onEnd()
        } else controller.enqueue(value)
      } catch (error) {
        controller.error(error)
        onEnd()
      }
    },
    cancel(reason) {
      onEnd()
      return reader.cancel(reason)
    },
  })
  return new Response(body, { status: response.status, headers: response.headers })
}

/**
 * Serves one MCP HTTP exchange for an authenticated workspace. The server is closed when
 * the response ends, the client goes away, or `DELETED_GRACE_MS` after the workspace is
 * deleted (`workspace.deleted` on the bus): no response stream outlives its workspace.
 */
export async function handleMcpRequest(
  request: Request,
  ctx: McpContext,
  options: McpHttpOptions = {},
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed()
  const server = createMailsinkMcpServer(ctx)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    ...(options.maxBodyBytes ? { maxRequestBodySize: options.maxBodyBytes } : {}),
  })
  let closed = false
  let grace: ReturnType<typeof setTimeout> | undefined
  const close = () => {
    if (closed) return
    closed = true
    clearTimeout(grace)
    off()
    request.signal.removeEventListener('abort', close)
    void server.close()
  }
  // The calls in flight answer first (a pending wait_for_email fails with not_found);
  // whatever still runs after the grace delay is cut.
  const off = ctx.bus.subscribe(ctx.workspace.id, (frame) => {
    if (frame.event.type === 'workspace.deleted' && !grace) {
      grace = setTimeout(close, options.deletedGraceMs ?? DELETED_GRACE_MS)
    }
  })
  request.signal.addEventListener('abort', close)
  try {
    await server.connect(transport)
    return whenBodyEnds(await transport.handleRequest(request), close)
  } catch (error) {
    close()
    throw error
  }
}
