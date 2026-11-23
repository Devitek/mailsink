import { BatchRequest, SendEmailRequest } from '@mailsink/contracts'
import {
  type IngestOutcome,
  type IngestTarget,
  readIdempotencyKey,
  sendNativeBatch,
  sendNativeEmail,
} from '@mailsink/core'
import type { ConnectionAuth } from '../auth'
import { defineApi } from '../handler'
import { INGESTION_EXTENSIONS } from '../ingestion-guard'

/** Set on a response replayed from a previous request with the same Idempotency-Key. */
export const REPLAYED_HEADER = 'Idempotent-Replayed'

const targetOf = (auth: ConnectionAuth): IngestTarget => ({
  workspaceId: auth.workspace.id,
  connectionId: auth.connection.id,
  source: 'native',
})

function toResponse({ response, replayed }: IngestOutcome): Response {
  return Response.json(response.body, {
    status: response.status,
    headers: replayed ? { [REPLAYED_HEADER]: 'true' } : {},
  })
}

/** `POST /v1/emails`: any connection key (`msk_`) of the workspace. */
export const postEmail = defineApi({
  auth: 'connection',
  body: SendEmailRequest,
  maxBodyBytes: 'message',
  extensions: INGESTION_EXTENSIONS,
  handler: async ({ request, runtime, auth, body }) =>
    toResponse(
      await sendNativeEmail(
        { db: runtime.db.db, maxMessageBytes: runtime.config.maxMessageBytes, bus: runtime.bus },
        targetOf(auth),
        body,
        readIdempotencyKey(request.headers),
      ),
    ),
})

/** `POST /v1/emails/batch`: items validated one by one (D33), 200 or 207. */
export const postEmailBatch = defineApi({
  auth: 'connection',
  body: BatchRequest,
  maxBodyBytes: 'message',
  extensions: INGESTION_EXTENSIONS,
  handler: async ({ request, runtime, auth, body }) =>
    toResponse(
      await sendNativeBatch(
        { db: runtime.db.db, maxMessageBytes: runtime.config.maxMessageBytes, bus: runtime.bus },
        targetOf(auth),
        body,
        readIdempotencyKey(request.headers),
      ),
    ),
})
