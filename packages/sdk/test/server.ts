// Test-only: the real HTTP routes of the app (`apps/mailsink/src/routes`) behind a Node
// listener on a loopback port, so the SDK runs over plain `fetch` as it does in production.
import { readdirSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo, Socket } from 'node:net'
import { Readable } from 'node:stream'
import { pathToFileURL } from 'node:url'
import { routesDir } from '@mailsink/app/testing'

type Handler = (input: { request: Request; params: Record<string, string> }) => Promise<Response>
interface Route {
  pattern: RegExp
  names: string[]
  handlers: Record<string, Handler>
}

// The HTTP API only: UI pages and the MCP endpoint are not the SDK's business.
const API_FILE = /^(admin|capture|v1|v3)\..*\.ts$/

/** `capture.messages.$id.raw.ts` -> `/capture/messages/:id/raw` (`[x]` escapes a segment). */
async function loadRoutes(): Promise<Route[]> {
  const files = readdirSync(routesDir).filter((f) => API_FILE.test(f))
  const routes: Route[] = []
  for (const file of files) {
    const mod = await import(pathToFileURL(new URL(file, routesDir).pathname).href)
    const handlers = mod.Route?.options?.server?.handlers as Record<string, Handler> | undefined
    if (!handlers) throw new Error(`${file}: no server handlers`)
    const names: string[] = []
    const source = file
      .replace(/\.ts$/, '')
      .split('.')
      .map((s) => {
        if (s.startsWith('$')) {
          names.push(s.slice(1))
          return '([^/]+)'
        }
        return s.replace(/^\[(.*)\]$/, '$1')
      })
      .join('/')
    routes.push({ pattern: new RegExp(`^/${source}$`), names, handlers })
  }
  // Literal segments first: `/capture/webhooks/deliveries` before `/capture/webhooks/:id`.
  return routes.sort((a, b) => a.names.length - b.names.length)
}

async function toRequest(req: IncomingMessage, base: string, signal: AbortSignal) {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(name, value)
    else if (Array.isArray(value)) for (const v of value) headers.append(name, v)
  }
  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined
  return new Request(new URL(req.url ?? '/', base), { method: req.method, headers, body, signal })
}

export interface TestServer {
  url: string
  /** Request headers seen so far, per path (`/capture/stream`...). */
  seen: { method: string; path: string; query: URLSearchParams; headers: Headers }[]
  /** Cuts every open connection (SSE streams included), as a network drop would. */
  dropConnections(): void
  close(): Promise<void>
}

export async function startTestServer(): Promise<TestServer> {
  const routes = await loadRoutes()
  const sockets = new Set<Socket>()
  const seen: TestServer['seen'] = []
  let url = ''
  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const controller = new AbortController()
    res.on('close', () => controller.abort())
    const request = await toRequest(req, url, controller.signal)
    const { pathname, searchParams } = new URL(request.url)
    seen.push({
      method: request.method,
      path: pathname,
      query: searchParams,
      headers: request.headers,
    })
    const response = await dispatch(routes, request, pathname)
    res.writeHead(response.status, Object.fromEntries(response.headers))
    res.flushHeaders()
    if (!response.body) return void res.end()
    Readable.fromWeb(response.body as never)
      .on('error', () => res.destroy())
      .pipe(res)
  }
  const server = createServer((req, res) => {
    handle(req, res).catch((error) => {
      console.error(error)
      res.destroy()
    })
  })
  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return {
    url,
    seen,
    dropConnections: () => {
      for (const socket of sockets) socket.destroy()
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        for (const socket of sockets) socket.destroy()
        server.close((e) => (e ? reject(e) : resolve()))
      }),
  }
}

function dispatch(routes: Route[], request: Request, pathname: string): Promise<Response> {
  for (const route of routes) {
    const match = route.pattern.exec(pathname)
    if (!match) continue
    const handler = route.handlers[request.method]
    if (!handler) return Promise.resolve(new Response('method not allowed', { status: 405 }))
    const params = Object.fromEntries(
      route.names.map((n, i) => [n, decodeURIComponent(match[i + 1] ?? '')]),
    )
    return handler({ request, params })
  }
  return Promise.resolve(new Response('not found', { status: 404 }))
}
