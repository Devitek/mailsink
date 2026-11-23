// Message tools: list_emails, get_email, wait_for_email (same services as `GET
// /capture/messages`, `GET /capture/messages/:id` and `wait=true`, D4, D6).
import { ListMessagesQuery } from '@mailsink/contracts'
import { getCapturedMessage, listCapturedMessages, waitForMessages } from '@mailsink/core'
import type { McpServer } from '@modelcontextprotocol/server'
import type { McpContext } from '../context'
import { parseContract, runTool } from '../result'
import { GetEmailInput, ListEmailsInput, WaitForEmailInput } from '../schemas'

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const

export function registerMessageTools(server: McpServer, ctx: McpContext): void {
  const workspaceId = ctx.workspace.id

  server.registerTool(
    'list_emails',
    {
      title: 'List captured emails',
      description:
        'Search the emails captured in this workspace, newest first. Filters: to, from, subject ' +
        '(substrings), tag ("name" or "name:value"), status, connectionId, since, until, q ' +
        '(full text). Paginate with limit and the nextCursor of the previous page.',
      inputSchema: ListEmailsInput,
      annotations: READ_ONLY,
    },
    (args) =>
      runTool(() =>
        listCapturedMessages(
          ctx.db,
          workspaceId,
          parseContract(ListMessagesQuery, { ...args, wait: false }),
        ),
      ),
  )

  server.registerTool(
    'get_email',
    {
      title: 'Get one email',
      description:
        'One captured email in full: addresses, html and text bodies, headers, links, ' +
        'attachments, per-recipient status, events and webhook deliveries.',
      inputSchema: GetEmailInput,
      annotations: READ_ONLY,
    },
    ({ id }) => runTool(() => getCapturedMessage(ctx.db, workspaceId, id)),
  )

  server.registerTool(
    'wait_for_email',
    {
      title: 'Wait for an email',
      description:
        'Waits until at least one email matches the filters, then returns the first page. ' +
        'Without since, only emails captured after the call count. Fails with wait_timeout ' +
        'after timeout milliseconds (default and max 30000).',
      inputSchema: WaitForEmailInput,
      annotations: READ_ONLY,
    },
    (args, extra) =>
      runTool(() =>
        waitForMessages(
          { db: ctx.db, bus: ctx.bus, signal: extra.mcpReq.signal },
          workspaceId,
          parseContract(ListMessagesQuery, { ...args, wait: true }),
        ),
      ),
  )
}
