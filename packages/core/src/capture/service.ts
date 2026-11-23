import type {
  ListMessagesQuery,
  MessageSummary,
  PurgeQuery,
  PurgeResponse,
} from '@mailsink/contracts'
import {
  type Database,
  findAttachmentContent,
  findRawMessage,
  findWorkspaceMessage,
  listAttachments,
  listMessageEvents,
  listRecipients,
  purgeMessages,
  searchMessages,
} from '@mailsink/db'
import { DomainError } from '../errors'
import { listMessageWebhookDeliveries } from '../webhooks/deliveries'
import { encodeCursor } from './cursor'
import { toMessageSearch } from './query'
import { type CapturedMessageDetail, toDetail, toSummary } from './views'

// Every function takes the workspace of the authenticated caller: a message of another
// workspace is indistinguishable from a missing one (404, never 403).

/** `ListMessagesResponse` of the contract (which exports no type alias for it). */
export type MessagePage = { data: MessageSummary[]; nextCursor: string | null }

const messageNotFound = () => new DomainError('not_found', 'Message not found')

export async function listCapturedMessages(
  db: Database,
  workspaceId: string,
  query: ListMessagesQuery,
): Promise<MessagePage> {
  const search = toMessageSearch(workspaceId, query)
  const rows = await searchMessages(db, search)
  const page = rows.slice(0, search.limit)
  const recipients = await listRecipients(
    db,
    page.map((m) => m.id),
  )
  const last = page.at(-1)
  return {
    data: page.map((m) =>
      toSummary(
        m,
        recipients.filter((r) => r.messageId === m.id),
      ),
    ),
    nextCursor:
      rows.length > search.limit && last
        ? encodeCursor({ createdAt: last.cursorAt, id: last.id })
        : null,
  }
}

export async function getCapturedMessage(
  db: Database,
  workspaceId: string,
  messageId: string,
): Promise<CapturedMessageDetail> {
  const message = await findWorkspaceMessage(db, workspaceId, messageId)
  if (!message) throw messageNotFound()
  const [recipients, attachments, events, webhookDeliveries] = await Promise.all([
    listRecipients(db, [message.id]),
    listAttachments(db, message.id),
    listMessageEvents(db, message.id),
    listMessageWebhookDeliveries(db, workspaceId, message.id),
  ])
  return toDetail({ message, recipients, attachments, events, webhookDeliveries })
}

/** Raw EML (D9). */
export async function readRawMessage(
  db: Database,
  workspaceId: string,
  messageId: string,
): Promise<Uint8Array> {
  const data = await findRawMessage(db, workspaceId, messageId)
  if (!data) throw new DomainError('not_found', 'Raw message not found')
  return data
}

export interface AttachmentContent {
  filename: string | null
  contentType: string
  disposition: 'attachment' | 'inline'
  data: Uint8Array
}

export async function readAttachment(
  db: Database,
  workspaceId: string,
  messageId: string,
  attachmentId: string,
): Promise<AttachmentContent> {
  const found = await findAttachmentContent(db, workspaceId, messageId, attachmentId)
  if (!found) throw new DomainError('not_found', 'Attachment not found')
  const { filename, contentType, disposition, data } = found
  return { filename, contentType, disposition, data }
}

export async function purgeCapturedMessages(
  db: Database,
  workspaceId: string,
  query: PurgeQuery,
): Promise<PurgeResponse> {
  const count = await purgeMessages(db, {
    workspaceId,
    connectionId: query.connectionId,
    before: query.before ? new Date(query.before) : undefined,
    includeLogs: query.includeLogs,
  })
  return { count }
}
