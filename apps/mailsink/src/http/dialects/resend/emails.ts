import { ResendBatchValidation } from '@mailsink/contracts'
import {
  getResendEmail,
  type IngestOutcome,
  type IngestTarget,
  readResendIdempotencyKey,
  resendError,
  sendResendBatch,
  sendResendEmail,
} from '@mailsink/core'
import { z } from 'zod'
import type { Runtime } from '../../../runtime/container'
import type { ConnectionAuth } from '../../auth'
import { defineApi } from '../../handler'
import { REPLAYED_HEADER } from '../../native/emails'
import { resendErrorBody } from './errors'
import { RESEND_EXTENSIONS } from './extensions'

export const BATCH_VALIDATION_HEADER = 'x-batch-validation'

const targetOf = (auth: ConnectionAuth): IngestTarget => ({
  workspaceId: auth.workspace.id,
  connectionId: auth.connection.id,
  source: 'resend',
})

const depsOf = (runtime: Runtime) => ({
  db: runtime.db.db,
  maxMessageBytes: runtime.config.maxMessageBytes,
  bus: runtime.bus,
})

function toResponse({ response, replayed }: IngestOutcome): Response {
  return Response.json(response.body, {
    status: response.status,
    headers: replayed ? { [REPLAYED_HEADER]: 'true' } : {},
  })
}

function batchValidation(headers: Headers): ResendBatchValidation {
  const raw = headers.get(BATCH_VALIDATION_HEADER)?.trim().toLowerCase() || 'strict'
  const parsed = ResendBatchValidation.safeParse(raw)
  if (parsed.success) return parsed.data
  throw resendError({
    name: 'validation_error',
    status: 400,
    message: 'The `x-batch-validation` header must be `strict` or `permissive`.',
  })
}

// The bodies are validated by the dialect (@mailsink/core parseResendEmail), which words
// errors as Resend; defineApi only caps and reads the JSON (`z.unknown()`).
const common = {
  auth: 'connection',
  errorFormat: resendErrorBody,
  extensions: RESEND_EXTENSIONS,
} as const

/** `POST /emails`: a `resend` connection key (`msk_`). */
export const postResendEmail = defineApi({
  ...common,
  body: z.unknown(),
  maxBodyBytes: 'message',
  handler: async ({ request, runtime, auth, body }) =>
    toResponse(
      await sendResendEmail(
        depsOf(runtime),
        targetOf(auth),
        body,
        readResendIdempotencyKey(request.headers),
      ),
    ),
})

/** `POST /emails/batch`: all or nothing (`strict`, default) or `permissive`. */
export const postResendBatch = defineApi({
  ...common,
  body: z.unknown(),
  maxBodyBytes: 'message',
  handler: async ({ request, runtime, auth, body }) =>
    toResponse(
      await sendResendBatch(
        depsOf(runtime),
        targetOf(auth),
        body,
        batchValidation(request.headers),
        readResendIdempotencyKey(request.headers),
      ),
    ),
})

/** `GET /emails/:id`: a message of the workspace by its Resend id. */
export const getResendEmailRoute = defineApi({
  ...common,
  params: z.object({ id: z.string() }),
  handler: ({ runtime, auth, params }) =>
    getResendEmail(runtime.db.db, auth.workspace.id, params.id),
})
