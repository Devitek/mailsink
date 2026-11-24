// Content tools (D180): get_email_source (raw MIME, the EML of
// `GET /capture/messages/:id/raw`) and get_email_attachment (`GET
// /capture/messages/:id/attachments/:attId`). Both answer an embedded resource whose URI is
// the absolute download URL, plus a JSON summary for clients that skip resources.
import { capturePaths, readAttachment, readRawMessage } from '@mailsink/core'
import type { CallToolResult, McpServer } from '@modelcontextprotocol/server'
import type { McpContext } from '../context'
import { errorResult } from '../result'
import { GetEmailAttachmentInput, GetEmailSourceInput } from '../schemas'
import { absolute } from '../urls'

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const

/** Text types are returned as text, anything else as base64 (`blob`). */
const isText = (contentType: string) =>
  /^text\//i.test(contentType) || /^application\/(json|xml)\b/i.test(contentType)

function summary(value: Record<string, unknown>) {
  return { type: 'text' as const, text: JSON.stringify(value, null, 2) }
}

async function safely(body: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await body()
  } catch (error) {
    return errorResult(error)
  }
}

export function registerContentTools(server: McpServer, ctx: McpContext): void {
  const workspaceId = ctx.workspace.id

  server.registerTool(
    'get_email_source',
    {
      title: 'Get the raw MIME source of an email',
      description:
        'The raw message (EML, message/rfc822) exactly as captured: every header, MIME part ' +
        'and encoding. Use get_email for the parsed bodies.',
      inputSchema: GetEmailSourceInput,
      annotations: READ_ONLY,
    },
    ({ id }) =>
      safely(async () => {
        const data = await readRawMessage(ctx.db, workspaceId, id)
        const uri = absolute(ctx.publicUrl, capturePaths.raw(id))
        const text = new TextDecoder().decode(data)
        return {
          content: [
            summary({ id, url: uri, contentType: 'message/rfc822', sizeBytes: data.byteLength }),
            { type: 'resource', resource: { uri, mimeType: 'message/rfc822', text } },
          ],
        }
      }),
  )

  server.registerTool(
    'get_email_attachment',
    {
      title: 'Get an email attachment',
      description:
        'The content of one attachment listed by get_email (attachments[].id): text types ' +
        'as text, anything else base64 encoded, with its filename and content type.',
      inputSchema: GetEmailAttachmentInput,
      annotations: READ_ONLY,
    },
    ({ id, attachmentId }) =>
      safely(async () => {
        const found = await readAttachment(ctx.db, workspaceId, id, attachmentId)
        const uri = absolute(ctx.publicUrl, capturePaths.attachment(id, attachmentId))
        const mimeType = found.contentType
        const resource = isText(mimeType)
          ? { uri, mimeType, text: new TextDecoder().decode(found.data) }
          : { uri, mimeType, blob: Buffer.from(found.data).toString('base64') }
        return {
          content: [
            summary({
              id: attachmentId,
              messageId: id,
              filename: found.filename,
              contentType: mimeType,
              disposition: found.disposition,
              sizeBytes: found.data.byteLength,
              url: uri,
              encoding: 'text' in resource ? 'text' : 'base64',
            }),
            { type: 'resource', resource },
          ],
        }
      }),
  )
}
