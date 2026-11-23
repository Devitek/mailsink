// Test-only local webhook receiver (outgoing HTTP in tests never leaves the machine).
import { createServer, type IncomingHttpHeaders } from 'node:http'
import type { AddressInfo } from 'node:net'

export interface ReceivedRequest {
  method: string
  path: string
  headers: IncomingHttpHeaders
  body: string
}

export interface TestReceiver {
  url: string
  received: ReceivedRequest[]
  /** Statuses answered in order; the last one repeats (default 200). */
  respondWith(...statuses: number[]): void
  close(): Promise<void>
}

export async function startTestReceiver(): Promise<TestReceiver> {
  const received: ReceivedRequest[] = []
  let statuses: number[] = [200]
  const server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      received.push({
        method: req.method ?? '',
        path: req.url ?? '',
        headers: req.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      })
      const status = statuses.length > 1 ? (statuses.shift() as number) : (statuses[0] ?? 200)
      res.writeHead(status, { 'content-type': 'text/plain' }).end(`status ${status}`)
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}/hook`,
    received,
    respondWith(...next) {
      statuses = next.length > 0 ? next : [200]
    },
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      }),
  }
}

/** Plain header record of a received request (svix verify takes string values). */
export function headerRecord(headers: IncomingHttpHeaders): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) if (typeof v === 'string') out[k] = v
  return out
}
