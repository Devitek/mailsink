// Tools that change state: trigger_email_event and purge_emails. They publish on the bus
// like their HTTP twins (`POST /capture/messages/:id/events`, `DELETE /capture/messages`),
// so the UI and the open SSE streams see MCP actions live (D6).
import { PurgeQuery, type TriggerEventResponse } from '@mailsink/contracts'
import {
  eventFrame,
  publishAll,
  publishDeliveries,
  purgeCapturedMessages,
  statusFrame,
  toEventView,
  triggerMessageEvent,
} from '@mailsink/core'
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
        'complained, failed). Updates statuses and the suppression list and fires webhooks.',
      inputSchema: TriggerEmailEventInput,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    ({ id, event }) =>
      runTool(async () => {
        const result = await triggerMessageEvent(ctx.db, workspaceId, id, event, 'mcp')
        const frames = result.events.map((row) => eventFrame(row, result.connectionId))
        if (result.messageStatus) {
          frames.push(statusFrame(id, result.messageStatus, result.connectionId))
        }
        publishAll(ctx.bus, workspaceId, frames)
        publishDeliveries(ctx.bus, workspaceId, result.deliveries)
        const response: TriggerEventResponse = {
          events: result.events.map(toEventView),
          webhookDeliveries: result.deliveries.map((d) => ({
            id: d.delivery.id,
            endpointId: d.delivery.endpointId,
          })),
        }
        return response
      }),
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
    (query) =>
      runTool(async () => {
        const purged = await purgeCapturedMessages(ctx.db, workspaceId, query)
        ctx.bus.publish(workspaceId, {
          id: null,
          connectionId: query.connectionId ?? null,
          event: { type: 'messages.purged', count: purged.count },
        })
        return purged
      }),
  )
}
