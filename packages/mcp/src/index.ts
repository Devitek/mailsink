// Public entry point: the MCP server factory, its tools and the stateless HTTP handler.
export type { McpContext } from './context'
export { handleMcpRequest, type McpHttpOptions } from './http'
export { errorResult, jsonResult, parseContract, runTool } from './result'
export { createMailsinkMcpServer, MCP_SERVER_NAME, MCP_SERVER_VERSION } from './server'
