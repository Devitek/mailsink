// Log tools: get_delivery_logs (API request log and SMTP sessions, #35) and, as
// propositions (D168), get_webhook_deliveries and list_suppressions. Read only.
import {
  ApiLogParams,
  ListApiLogsQuery,
  ListSmtpSessionsQuery,
  ListSuppressionsQuery,
  SmtpSessionParams,
} from '@mailsink/contracts'
import {
  getApiLogView,
  getSmtpSessionView,
  getWebhookDeliveryDetail,
  listApiLogViews,
  listSmtpSessionViews,
  listSuppressionViews,
  listWebhookDeliveryViews,
} from '@mailsink/core'
import type { McpServer } from '@modelcontextprotocol/server'
import type { z } from 'zod'
import type { McpContext } from '../context'
import { parseContract, runTool } from '../result'
import { GetDeliveryLogsInput, GetWebhookDeliveriesInput } from '../schemas'

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const

function deliveryLogs(ctx: McpContext, args: z.output<typeof GetDeliveryLogsInput>) {
  const workspaceId = ctx.workspace.id
  if (args.source === 'smtp') {
    if (args.id) {
      const { id } = parseContract(SmtpSessionParams, { id: args.id })
      return getSmtpSessionView(ctx.db, workspaceId, id)
    }
    const query = args.smtpFilters ?? parseContract(ListSmtpSessionsQuery, {})
    return listSmtpSessionViews(ctx.db, workspaceId, query)
  }
  if (args.id) {
    const { id } = parseContract(ApiLogParams, { id: args.id })
    return getApiLogView(ctx.db, workspaceId, id)
  }
  return listApiLogViews(
    ctx.db,
    workspaceId,
    args.apiFilters ?? parseContract(ListApiLogsQuery, {}),
  )
}

export function registerLogTools(server: McpServer, ctx: McpContext): void {
  const workspaceId = ctx.workspace.id

  server.registerTool(
    'get_delivery_logs',
    {
      title: 'Get delivery logs',
      description:
        'source api (default): the HTTP calls received by the workspace (status, error code, ' +
        'message ids), filtered by apiFilters. source smtp: the SMTP sessions (outcome, ' +
        'AUTH user, message ids), filtered by smtpFilters. With id: one entry with its ' +
        'headers and bodies, or its SMTP transcript. Pages: page and pageSize.',
      inputSchema: GetDeliveryLogsInput,
      annotations: READ_ONLY,
    },
    (args) => runTool(() => deliveryLogs(ctx, args)),
  )

  server.registerTool(
    'get_webhook_deliveries',
    {
      title: 'Get webhook deliveries',
      description:
        'The webhooks sent by the workspace, newest first, filtered by endpointId, ' +
        'payloadFormat, messageId or status. With id: one delivery with its exact body and ' +
        'every attempt (headers, response, error).',
      inputSchema: GetWebhookDeliveriesInput,
      annotations: READ_ONLY,
    },
    ({ id, ...query }) =>
      runTool(() =>
        id
          ? getWebhookDeliveryDetail(ctx.db, workspaceId, id)
          : listWebhookDeliveryViews(ctx.db, workspaceId, query),
      ),
  )

  server.registerTool(
    'list_suppressions',
    {
      title: 'List suppressed recipients',
      description:
        'The suppression list of the workspace (hard bounces, complaints, manual entries), ' +
        'newest first, filtered by an email substring.',
      inputSchema: ListSuppressionsQuery,
      annotations: READ_ONLY,
    },
    (query) => runTool(() => listSuppressionViews(ctx.db, workspaceId, query)),
  )
}
