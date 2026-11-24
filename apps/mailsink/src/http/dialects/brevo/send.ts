import { BrevoSendRequest } from '@mailsink/contracts'
import { readBrevoIdempotencyKey, sendBrevoEmail } from '@mailsink/core'
import { limitBody } from '../../body-limit'
import { defineApi } from '../../handler'
import { parseInput, readJsonBody } from '../../validation'
import { asBrevoStatus, brevoErrorBody } from './errors'
import { BREVO_EXTENSIONS } from './route'

/**
 * `POST /v3/smtp/email` (Brevo drop-in, #29): the `api-key` header (or a bearer) holding
 * the `msk_` key of a `brevo` connection. Rate limit and chaos run first (D92); the body
 * is read under `MAILSINK_MAX_MESSAGE_BYTES` and parsed here so that a validation error
 * answers 400, as Brevo does. Idempotency is Brevo's (D279): only the `idempotencyKey`
 * entry of the `headers` field counts (the `Idempotency-Key` HTTP header of the native API
 * is ignored, as Brevo ignores it), and any reuse within 30 minutes is refused.
 */
export const postBrevoEmail = defineApi({
  auth: 'connection',
  errorFormat: brevoErrorBody,
  extensions: BREVO_EXTENSIONS,
  handler: async ({ request, runtime, auth }) => {
    try {
      const raw = await readJsonBody(await limitBody(request, runtime.config.maxMessageBytes))
      const body = await parseInput(BrevoSendRequest, raw ?? {}, 'body')
      const { response } = await sendBrevoEmail(
        { db: runtime.db.db, maxMessageBytes: runtime.config.maxMessageBytes, bus: runtime.bus },
        { workspaceId: auth.workspace.id, connectionId: auth.connection.id, source: 'brevo' },
        body,
        readBrevoIdempotencyKey(body.headers),
      )
      return Response.json(response.body, { status: response.status })
    } catch (error) {
      throw asBrevoStatus(error)
    }
  },
})
