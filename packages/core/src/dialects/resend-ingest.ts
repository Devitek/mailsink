import {
  RESEND_MAX_BATCH_SIZE,
  type ResendBatchResponse,
  type ResendBatchValidation,
  type ResendSendResponse,
} from '@mailsink/contracts'
import { isDomainError } from '../errors'
import { publishAll, type StreamFrame } from '../events/bus'
import { hashRequest, readIdempotencyKey, runIdempotent } from '../ingestion/idempotency'
import type { IngestDeps, IngestOutcome } from '../ingestion/native'
import type { IngestTarget } from '../ingestion/normalize'
import { persistEmails } from '../ingestion/pipeline'
import { type PreparedEmail, prepareEmail } from '../ingestion/prepare'
import { fromResendRequest, parseResendEmail, type ResendIssue, resendError } from './resend'

/** Resend id of a message: the UUIDv7 of its `msg_` id (D120), so GET needs no lookup table. */
export const resendIdOf = (messageId: string) => messageId.slice(messageId.indexOf('_') + 1)
export const messageIdOfResend = (resendId: string) => `msg_${resendId.toLowerCase()}`

/** `Idempotency-Key` as the SDK sends it; over 256 characters is Resend's 400. */
export function readResendIdempotencyKey(headers: Headers): string | undefined {
  try {
    return readIdempotencyKey(headers)
  } catch {
    throw resendError({
      name: 'invalid_idempotency_key',
      status: 400,
      message: 'Idempotency keys, if present, must have between 1 and 256 characters.',
    })
  }
}

type Slot = { prepared: PreparedEmail } | { issue: ResendIssue }

async function prepareResend(item: unknown, deps: IngestDeps, batch: boolean): Promise<Slot> {
  const parsed = parseResendEmail(item, { batch })
  if (!parsed.ok) return { issue: parsed.issue }
  try {
    const prepared = await prepareEmail(fromResendRequest(parsed.data), {
      maxMessageBytes: deps.maxMessageBytes,
    })
    const email = { ...prepared.email, providerMessageId: resendIdOf(prepared.id) }
    return { prepared: { ...prepared, email } }
  } catch (error) {
    if (!isDomainError(error) || error.code !== 'payload_too_large') throw error
    return { issue: { name: 'validation_error', status: 413, message: error.message } }
  }
}

async function ingest(
  deps: IngestDeps,
  target: IngestTarget,
  scope: string,
  body: unknown,
  idempotencyKey: string | undefined,
  work: {
    prepare: () => Promise<Slot[]>
    respond: (slots: Slot[]) => unknown
  },
): Promise<IngestOutcome> {
  const frames: StreamFrame[] = []
  const outcome = await runIdempotent(
    deps.db,
    target.workspaceId,
    idempotencyKey ? { key: idempotencyKey, requestHash: hashRequest(scope, body) } : undefined,
    {
      prepare: work.prepare,
      persist: async (tx, slots) => {
        frames.length = 0 // a retried transaction starts over
        const ok = slots.flatMap((s) => ('prepared' in s ? [s.prepared] : []))
        await persistEmails(tx, target, ok, { idempotencyKey, frames })
        return { status: 200, body: work.respond(slots) }
      },
    },
  )
  if (!outcome.replayed) publishAll(deps.bus, target.workspaceId, frames)
  return outcome
}

/** `POST /emails`: 200 `{ id }` (a uuid), Resend error otherwise. */
export function sendResendEmail(
  deps: IngestDeps,
  target: IngestTarget,
  body: unknown,
  idempotencyKey?: string,
): Promise<IngestOutcome> {
  return ingest(deps, target, 'POST /emails', body, idempotencyKey, {
    prepare: async () => {
      const slot = await prepareResend(body, deps, false)
      if ('issue' in slot) throw resendError(slot.issue)
      return [slot]
    },
    respond: ([slot]) =>
      ({
        id: slot && 'prepared' in slot ? resendIdOf(slot.prepared.id) : '',
      }) satisfies ResendSendResponse,
  })
}

/**
 * `POST /emails/batch`: `strict` (default, Resend parity) stores everything or nothing and
 * answers the first refused item; `permissive` stores the valid items and lists the others
 * in `errors`.
 */
export function sendResendBatch(
  deps: IngestDeps,
  target: IngestTarget,
  body: unknown,
  mode: ResendBatchValidation,
  idempotencyKey?: string,
): Promise<IngestOutcome> {
  return ingest(deps, target, `POST /emails/batch ${mode}`, body, idempotencyKey, {
    prepare: async () => {
      if (!Array.isArray(body) || body.length === 0 || body.length > RESEND_MAX_BATCH_SIZE) {
        throw resendError({
          name: 'validation_error',
          status: 400,
          message: `The request body must be an array of 1 to ${RESEND_MAX_BATCH_SIZE} emails.`,
        })
      }
      const slots: Slot[] = []
      for (const [index, item] of body.entries()) {
        const slot = await prepareResend(item, deps, true)
        if (mode === 'strict' && 'issue' in slot) {
          throw resendError({ ...slot.issue, message: `emails[${index}]: ${slot.issue.message}` })
        }
        slots.push(slot)
      }
      return slots
    },
    respond: (slots) => {
      const data = slots.flatMap((s) =>
        'prepared' in s ? [{ id: resendIdOf(s.prepared.id) }] : [],
      )
      if (mode === 'strict') return { data } satisfies ResendBatchResponse
      const errors = slots.flatMap((s, index) =>
        'issue' in s ? [{ index, message: s.issue.message }] : [],
      )
      return { data, errors } satisfies ResendBatchResponse
    },
  })
}
