// `POST|GET|DELETE /mcp` (03-contracts, « MCP »): stateless Streamable HTTP (D165) behind
// the workspace scope auth of Capture (D12, D41). defineApi() authenticates, touches the
// workspace activity and logs the call (dialect `mcp`, D145); @mailsink/mcp serves it.
import { handleMcpRequest } from '@mailsink/mcp'
import { DEFAULT_MAX_BODY_BYTES } from './body-limit'
import { defineApi } from './handler'

export const mcpApi = defineApi({
  auth: 'workspace',
  handler: ({ request, runtime, auth }) =>
    handleMcpRequest(
      request,
      { db: runtime.db.db, bus: runtime.bus, workspace: auth.workspace },
      { maxBodyBytes: DEFAULT_MAX_BODY_BYTES },
    ),
})
