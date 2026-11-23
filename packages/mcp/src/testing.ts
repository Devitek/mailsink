// Test-only helpers (imported by *.test.ts files only): an SDK client wired in process to
// handleMcpRequest, through the real Streamable HTTP client transport.
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import type { McpContext } from './context'
import { handleMcpRequest } from './http'

export async function connectClient(ctx: McpContext): Promise<Client> {
  const client = new Client({ name: 'mailsink-test', version: '0.0.0' })
  const transport = new StreamableHTTPClientTransport(new URL('http://mailsink.test/mcp'), {
    fetch: (url, init) => handleMcpRequest(new Request(url, init), ctx),
  })
  await client.connect(transport)
  return client
}

/** The JSON a tool answered as text, with its error flag. */
// biome-ignore lint/suspicious/noExplicitAny: tests read arbitrary tool JSON
export function toolJson(result: unknown): { isError: boolean; json: any } {
  const r = result as { isError?: boolean; content: { type: string; text: string }[] }
  return { isError: r.isError === true, json: JSON.parse(r.content[0]?.text ?? 'null') }
}
