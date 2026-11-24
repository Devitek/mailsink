import { BrevoSendRequest } from '@mailsink/contracts'
import {
  DomainError,
  MAX_IDEMPOTENCY_KEY_LENGTH,
  readIdempotencyKey,
  sendBrevoEmail,
} from '@mailsink/core'
import { limitBody } from '../../body-limit'
import { defineApi } from '../../handler'
import { REPLAYED_HEADER } from '../../native/emails'
import { parseInput, readJsonBody } from '../../validation'
import { asBrevoStatus, brevoErrorBody } from './errors'
import { BREVO_EXTENSIONS } from './route'

/**
 * Idempotency key: the `Idempotency-Key` HTTP header (native semantics, D53), else the
 * `IdempotencyKey` (or `Idempotency-Key`) entry of the Brevo `headers` body field.
 */
function idempotencyKeyOf(request: Request, headers: Record<string, string> | undefined) {
  const fromHttp = readIdempotencyKey(request.headers)
  if (fromHttp) return fromHttp
  const entry = Object.entries(headers ?? {}).find(([name]) => /^idempotency-?key$/i.test(name))
  const key = entry?.[1].trim()
  if (!key) return undefined
  if (key.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    throw new DomainError(
      'validation_error',
      `IdempotencyKey must be at most ${MAX_IDEMPOTENCY_KEY_LENGTH} characters`,
      { status: 400 },
    )
  }
  return key
}

/**
 * `POST /v3/smtp/email` (Brevo drop-in, #29): the `api-key` header (or a bearer) holding
 * the `msk_` key of a `brevo` connection. Rate limit and chaos run first (D92); the body
 * is read under `MAILSINK_MAX_MESSAGE_BYTES` and parsed here so that a validation error
 * answers 400, as Brevo does.
 */
export const postBrevoEmail = defineApi({
  auth: 'connection',
  errorFormat: brevoErrorBody,
  extensions: BREVO_EXTENSIONS,
  handler: async ({ request, runtime, auth }) => {
    try {
      const raw = await readJsonBody(await limitBody(request, runtime.config.maxMessageBytes))
      const body = await parseInput(BrevoSendRequest, raw ?? {}, 'body')
      const { response, replayed } = await sendBrevoEmail(
        { db: runtime.db.db, maxMessageBytes: runtime.config.maxMessageBytes, bus: runtime.bus },
        { workspaceId: auth.workspace.id, connectionId: auth.connection.id, source: 'brevo' },
        body,
        idempotencyKeyOf(request, body.headers),
      )
      return Response.json(response.body, {
        status: response.status,
        headers: replayed ? { [REPLAYED_HEADER]: 'true' } : {},
      })
    } catch (error) {
      throw asBrevoStatus(error)
    }
  },
})
