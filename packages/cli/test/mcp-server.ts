// Test-only: a real HTTP server in front of @mailsink/mcp, standing in for a Mailsink
// instance (only the bearer check of the app's auth, the tools run for real).
import { once } from 'node:events'
import { createServer, type IncomingMessage, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { McpContext } from '@mailsink/mcp'
import { handleMcpRequest } from '@mailsink/mcp'

async function toRequest(req: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const headers = new Headers()
  for (const [name, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(name, value)
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
  return new Request(`http://127.0.0.1${req.url}`, {
    method: req.method,
    headers,
    body: hasBody ? Buffer.concat(chunks) : undefined,
  })
}

export interface FakeInstance {
  url: string
  /** Headers of every request received. */
  seen: Headers[]
  close(): Promise<void>
}

export async function startFakeInstance(ctx: McpContext, key: string): Promise<FakeInstance> {
  const seen: Headers[] = []
  const server: Server = createServer(async (req, res) => {
    const request = await toRequest(req)
    seen.push(request.headers)
    const response =
      new URL(request.url).pathname !== '/mcp'
        ? new Response('not found', { status: 404 })
        : request.headers.get('authorization') !== `Bearer ${key}`
          ? Response.json({ error: { code: 'unauthorized' } }, { status: 401 })
          : await handleMcpRequest(request, ctx)
    res.writeHead(response.status, Object.fromEntries(response.headers))
    if (response.body) for await (const chunk of response.body) res.write(chunk)
    res.end()
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}`,
    seen,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}
