// Test-only: the Resend routes behind a real HTTP listener, for the official SDK.
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { getResendEmailRoute, postResendBatch, postResendEmail } from './emails'

async function toRequest(req: IncomingMessage, base: string): Promise<Request> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(name, value)
    else if (Array.isArray(value)) for (const v of value) headers.append(name, v)
  }
  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined
  return new Request(new URL(req.url ?? '/', base), { method: req.method, headers, body })
}

function dispatch(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url)
  if (request.method === 'POST' && pathname === '/emails') return postResendEmail({ request })
  if (request.method === 'POST' && pathname === '/emails/batch') return postResendBatch({ request })
  const id = /^\/emails\/([^/]+)$/.exec(pathname)?.[1]
  if (request.method === 'GET' && id) return getResendEmailRoute({ request, params: { id } })
  return Promise.resolve(new Response('not found', { status: 404 }))
}

/** Listens on an ephemeral loopback port; resolves with its base URL and a closer. */
export async function startResendServer(): Promise<{
  baseUrl: string
  close: () => Promise<void>
}> {
  let baseUrl = ''
  const server: Server = createServer(async (req, res) => {
    const response = await dispatch(await toRequest(req, baseUrl))
    res.writeHead(response.status, Object.fromEntries(response.headers))
    res.end(Buffer.from(await response.arrayBuffer()))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return {
    baseUrl,
    close: () =>
      new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))),
  }
}
