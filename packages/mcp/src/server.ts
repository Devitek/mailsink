import { MAILSINK_VERSION } from '@mailsink/contracts'
import { McpServer } from '@modelcontextprotocol/server'
import type { McpContext } from './context'
import { registerActionTools } from './tools/actions'
import { registerContentTools } from './tools/content'
import { registerLogTools } from './tools/logs'
import { registerMessageTools } from './tools/messages'
import { registerOverrideTools } from './tools/override'

export const MCP_SERVER_NAME = 'mailsink'
/** Release version (one place, D181), announced in `serverInfo`. */
export const MCP_SERVER_VERSION = MAILSINK_VERSION

const INSTRUCTIONS =
  'Mailsink captures the emails an application sends in a test workspace. Typical flow: ' +
  'trigger the email in the application, call wait_for_email with a to or subject filter, ' +
  'then get_email for the bodies and links (get_email_source and get_email_attachment for ' +
  'the raw MIME and the files). trigger_email_event simulates opens, clicks and bounces; ' +
  'set_override_config forces simulation outcomes; purge_emails cleans up.'

/**
 * One MCP server bound to one authenticated workspace (transport-agnostic): the HTTP route
 * builds a fresh one per request (stateless Streamable HTTP, D165).
 */
export function createMailsinkMcpServer(ctx: McpContext): McpServer {
  const server = new McpServer(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    { instructions: INSTRUCTIONS },
  )
  registerMessageTools(server, ctx)
  registerContentTools(server, ctx)
  registerActionTools(server, ctx)
  registerOverrideTools(server, ctx)
  registerLogTools(server, ctx)
  return server
}
