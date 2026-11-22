// Capture API v1 (03-contracts, « Capture »): workspace scope auth (D12, D41). Every query
// is scoped to the authenticated workspace, so another workspace's ids answer 404.
import { AttachmentId, ListMessagesQuery, MessageId, PurgeQuery } from '@mailsink/contracts'
import {
  getCapturedMessage,
  listCapturedMessages,
  purgeCapturedMessages,
  readAttachment,
  readRawMessage,
} from '@mailsink/core'
import { z } from 'zod'
import { defineApi } from '../http/handler'
import { binaryResponse, contentDisposition, safeContentType } from './download'

const MessageParams = z.object({ id: MessageId })
const AttachmentParams = z.object({ id: MessageId, attId: AttachmentId })

/** GET /capture/messages: search with filters and cursor pagination (wait=true: #26). */
export const listMessages = defineApi({
  auth: 'workspace',
  query: ListMessagesQuery,
  handler: ({ runtime, auth, query }) =>
    listCapturedMessages(runtime.db.db, auth.workspace.id, query),
})

/** DELETE /capture/messages: purge messages (and logs unless includeLogs=false). */
export const purgeMessages = defineApi({
  auth: 'workspace',
  query: PurgeQuery,
  handler: ({ runtime, auth, query }) =>
    purgeCapturedMessages(runtime.db.db, auth.workspace.id, query),
})

/** GET /capture/messages/:id */
export const getMessage = defineApi({
  auth: 'workspace',
  params: MessageParams,
  handler: ({ runtime, auth, params }) =>
    getCapturedMessage(runtime.db.db, auth.workspace.id, params.id),
})

/** GET /capture/messages/:id/raw: the MIME source as `message/rfc822`. */
export const getRawMessage = defineApi({
  auth: 'workspace',
  params: MessageParams,
  handler: async ({ runtime, auth, params }) => {
    const data = await readRawMessage(runtime.db.db, auth.workspace.id, params.id)
    return binaryResponse(data, {
      contentType: 'message/rfc822',
      disposition: contentDisposition('attachment', `${params.id}.eml`),
    })
  },
})

/** GET /capture/messages/:id/attachments/:attId: the bytes with their type and disposition. */
export const getAttachment = defineApi({
  auth: 'workspace',
  params: AttachmentParams,
  handler: async ({ runtime, auth, params }) => {
    const found = await readAttachment(runtime.db.db, auth.workspace.id, params.id, params.attId)
    return binaryResponse(found.data, {
      contentType: safeContentType(found.contentType),
      disposition: contentDisposition(found.disposition, found.filename),
    })
  },
})
