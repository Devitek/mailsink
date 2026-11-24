// `mailsink mcp` (D14): a stdio MCP server that forwards every JSON-RPC message to the
// Streamable HTTP endpoint of a Mailsink instance, so stdio never needs database access.
// stdout carries the protocol only (one JSON message per line); diagnostics go to stderr.
import { createInterface } from 'node:readline'
import type { Readable, Writable } from 'node:stream'
import { type FetchLike, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import type { Io } from '../output'

export interface McpProxyOptions {
  /** Base URL of the instance (`MAILSINK_URL`) or its `/mcp` endpoint. */
  url: string
  /** `mskw_` or `msk_` key of the workspace, or the Admin key with `workspace`. */
  key: string
  /** `X-Mailsink-Workspace` (id or slug), needed with the Admin key only. */
  workspace?: string
  stdin?: Readable
  stdout?: Writable
  fetch?: FetchLike
}

type Message = Parameters<StreamableHTTPClientTransport['send']>[0]
type Id = string | number

/** `http://host:3000` and `http://host:3000/mcp` both name the endpoint. */
export function mcpEndpoint(url: string): URL {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Invalid MAILSINK_URL: expected an http(s) URL')
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error('Invalid MAILSINK_URL: expected an http(s) URL')
  }
  const path = parsed.pathname.replace(/\/+$/, '')
  if (!path.endsWith('/mcp')) parsed.pathname = `${path}/mcp`
  return parsed
}

const requestId = (m: Message): Id | undefined =>
  'method' in m && 'id' in m ? (m.id as Id | undefined) : undefined
const responseId = (m: Message): Id | undefined =>
  !('method' in m) && 'id' in m ? (m.id as Id | undefined) : undefined

/**
 * Runs the proxy until stdin ends and every forwarded request got its answer, so
 * `printf '…' | mailsink mcp` works as well as a long-lived client.
 */
export async function mcpCommand(options: McpProxyOptions, io: Io): Promise<void> {
  const stdin = options.stdin ?? process.stdin
  const stdout = options.stdout ?? process.stdout
  const headers: Record<string, string> = { Authorization: `Bearer ${options.key}` }
  if (options.workspace) headers['X-Mailsink-Workspace'] = options.workspace
  const upstream = new StreamableHTTPClientTransport(mcpEndpoint(options.url), {
    requestInit: { headers },
    ...(options.fetch ? { fetch: options.fetch } : {}),
  })

  const pending = new Set<Id>()
  let drained: (() => void) | undefined
  const settle = (id: Id | undefined) => {
    if (id === undefined) return
    pending.delete(id)
    if (pending.size === 0) drained?.()
  }
  const sends = new Set<Promise<void>>()
  let closing = false
  const write = (message: unknown) => stdout.write(`${JSON.stringify(message)}\n`)
  const fail = (reason: string) => io.err(`[mailsink mcp] ${reason}`)

  upstream.onmessage = (message) => {
    // The client transport sends the negotiated version on every later request.
    const result = 'result' in message ? (message.result as { protocolVersion?: unknown }) : null
    if (typeof result?.protocolVersion === 'string') {
      upstream.setProtocolVersion(result.protocolVersion)
    }
    write(message)
    settle(responseId(message))
  }
  // Closing aborts the optional GET stream the client transport may have opened.
  upstream.onerror = (error) => {
    if (!closing) fail(error.message)
  }

  const forward = (message: Message) => {
    const id = requestId(message)
    if (id !== undefined) pending.add(id)
    const sent = upstream.send(message).catch((error: unknown) => {
      // The transport already reported it through onerror.
      const reason = error instanceof Error ? error.message : String(error)
      if (id === undefined) return
      write({
        jsonrpc: '2.0',
        id,
        error: { code: -32000, message: `Mailsink MCP endpoint unreachable or refused: ${reason}` },
      })
      settle(id)
    })
    sends.add(sent)
    void sent.finally(() => sends.delete(sent))
  }

  await upstream.start()
  for await (const line of createInterface({ input: stdin, crlfDelay: Infinity })) {
    if (!line.trim()) continue
    let message: Message
    try {
      message = JSON.parse(line) as Message
    } catch {
      write({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })
      continue
    }
    forward(message)
  }
  await Promise.allSettled([...sends])
  if (pending.size > 0) await new Promise<void>((resolve) => (drained = resolve))
  closing = true
  await upstream.close()
}
