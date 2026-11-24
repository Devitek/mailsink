// Tools that change state: trigger_email_event and purge_emails. They run the same core
// services as their HTTP twins (`POST /capture/messages/:id/events`, `DELETE
// /capture/messages`), which publish on the bus, so the UI and the open SSE streams see MCP
// actions live (D6).
import { PurgeQuery } from '@mailsink/contracts'
import { purgeAndPublish, triggerAndPublishEvent } from '@mailsink/core'
import type { McpServer } from '@modelcontextprotocol/server'
import type { McpContext } from '../context'
import { runTool } from '../result'
import { TriggerEmailEventInput } from '../schemas'

export function registerActionTools(server: McpServer, ctx: McpContext): void {
  const workspaceId = ctx.workspace.id

  server.registerTool(
    'trigger_email_event',
    {
      title: 'Trigger an email event',
      description:
        'Records an event on a captured email, origin mcp: opened, clicked (url required) or ' +
        'a forced simulated status (delivered, deferred, soft_bounce, hard_bounce, ' +
        'complained, failed, invalid). Updates statuses and the suppression list and fires ' +
        'webhooks.',
      inputSchema: TriggerEmailEventInput,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    ({ id, event }) => runTool(() => triggerAndPublishEvent(ctx, workspaceId, id, event, 'mcp')),
  )

  server.registerTool(
    'purge_emails',
    {
      title: 'Purge captured emails',
      description:
        'Deletes the captured emails of the workspace (optionally one connection, or only ' +
        'those created before a date), with their request logs unless includeLogs is false. ' +
        'Returns the number of emails deleted.',
      inputSchema: PurgeQuery,
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    (query) => runTool(() => purgeAndPublish(ctx, workspaceId, query)),
  )
}
