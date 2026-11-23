// `POST|GET|DELETE /mcp` (03-contracts, « MCP »): stateless Streamable HTTP (D165) behind
// the workspace scope auth of Capture (D12, D41). defineApi() authenticates, touches the
// workspace activity and logs the call (dialect `mcp`, D145); @mailsink/mcp serves it.
import { handleMcpRequest } from '@mailsink/mcp'
import { DEFAULT_MAX_BODY_BYTES, limitBody } from './body-limit'
import { defineApi } from './handler'

export const mcpApi = defineApi({
  auth: 'workspace',
  // The body is read through limitBody (size cap, D105) so the request log keeps the
  // JSON-RPC call (D157); the MCP transport then reads the buffered copy.
  // The copy keeps the client's abort signal, which closes the MCP stream.
  handler: async ({ request, runtime, auth }) =>
    handleMcpRequest(
      request.method === 'POST'
        ? new Request(await limitBody(request, DEFAULT_MAX_BODY_BYTES), { signal: request.signal })
        : request,
      {
        db: runtime.db.db,
        bus: runtime.bus,
        workspace: auth.workspace,
        publicUrl: runtime.config.publicUrl,
      },
      { maxBodyBytes: DEFAULT_MAX_BODY_BYTES },
    ),
})
