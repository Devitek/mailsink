import { ListApiLogsQuery, ListSmtpSessionsQuery } from '@mailsink/contracts'
import {
  getApiLogView,
  getCapturedMessage,
  getSmtpSessionView,
  listApiLogViews,
  listSmtpSessionViews,
} from '@mailsink/core'
import type { Runtime } from '../runtime/container'
import { workspaceOfSlug } from './messages.server'
import type { MessageOrigin } from './messages-types'

const ENVELOPE = /^(HELO|EHLO|MAIL FROM|RCPT TO)\b/i

/**
 * The request or SMTP session that created a message (#106): the API log row whose
 * `messageIds` holds it, else the SMTP session that holds it. An unknown message is an
 * error (`not_found`), a message without log is `null`.
 */
export async function readMessageOrigin(
  runtime: Runtime,
  slug: string,
  messageId: string,
): Promise<MessageOrigin | null> {
  const db = runtime.db.db
  const { id: workspaceId } = await workspaceOfSlug(runtime, slug)
  const message = await getCapturedMessage(db, workspaceId, messageId)
  if (message.source === 'smtp') {
    const query = ListSmtpSessionsQuery.parse({ messageId, pageSize: 1 })
    const [found] = (await listSmtpSessionViews(db, workspaceId, query)).data
    if (!found) return null
    const session = await getSmtpSessionView(db, workspaceId, found.id)
    return {
      kind: 'smtp',
      sessionId: session.id,
      startedAt: session.startedAt,
      envelope: session.transcript
        .filter((line) => line.dir === 'C' && ENVELOPE.test(line.line))
        .map((line) => line.line),
    }
  }
  const query = ListApiLogsQuery.parse({ messageId, pageSize: 1 })
  const [found] = (await listApiLogViews(db, workspaceId, query)).data
  if (!found) return null
  const log = await getApiLogView(db, workspaceId, found.id)
  return {
    kind: 'api',
    logId: log.id,
    dialect: log.dialect,
    method: log.method,
    path: log.path,
    statusCode: log.statusCode,
    createdAt: log.createdAt,
    body: log.requestBody === null ? null : JSON.stringify(log.requestBody, null, 2),
  }
}
