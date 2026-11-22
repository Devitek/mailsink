import {
  type ApiError,
  type BatchItemResult,
  type BatchResponse,
  parseBatchItem,
  type SendEmailRequest,
  type SendEmailResponse,
} from '@mailsink/contracts'
import type { Database } from '@mailsink/db'
import { fromNativeRequest } from '../dialects/native'
import { isDomainError } from '../errors'
import { hashRequest, runIdempotent, type StoredResponse } from './idempotency'
import type { IngestTarget } from './normalize'
import { persistEmails } from './pipeline'
import { type PreparedEmail, prepareEmail } from './prepare'

export interface IngestDeps {
  db: Database
  maxMessageBytes: number
}

export interface IngestOutcome {
  response: StoredResponse
  /** True when the response comes from a previous request with the same Idempotency-Key. */
  replayed: boolean
}

const idempotency = (scope: string, key: string | undefined, body: unknown) =>
  key ? { key, requestHash: hashRequest(scope, body) } : undefined

/** `POST /v1/emails`: one validated request, 200 `{ id, status }`. */
export function sendNativeEmail(
  deps: IngestDeps,
  target: IngestTarget,
  request: SendEmailRequest,
  idempotencyKey?: string,
): Promise<IngestOutcome> {
  return runIdempotent(
    deps.db,
    target.workspaceId,
    idempotency('POST /v1/emails', idempotencyKey, request),
    {
      prepare: () =>
        prepareEmail(fromNativeRequest(request), { maxMessageBytes: deps.maxMessageBytes }),
      persist: async (tx, prepared) => {
        const [message] = await persistEmails(tx, target, [prepared], { idempotencyKey })
        if (!message) throw new Error('message not persisted')
        return {
          status: 200,
          body: { id: message.id, status: message.status } satisfies SendEmailResponse,
        }
      },
    },
  )
}

type Slot = { index: number; prepared: PreparedEmail } | { index: number; error: ApiError }

async function prepareItem(item: unknown, index: number, maxMessageBytes: number): Promise<Slot> {
  const parsed = parseBatchItem(item)
  if (!parsed.ok) return { index, error: parsed.error }
  try {
    return {
      index,
      prepared: await prepareEmail(fromNativeRequest(parsed.data), { maxMessageBytes }),
    }
  } catch (error) {
    if (!isDomainError(error)) throw error
    const apiError: ApiError = { code: error.code, message: error.message }
    if (error.details !== undefined) apiError.details = error.details
    return { index, error: apiError }
  }
}

/**
 * `POST /v1/emails/batch` (D33): items are validated and prepared one by one, an invalid or
 * oversized item fails its own slot; the valid ones are stored in one transaction.
 * 200 when every item is accepted, 207 otherwise.
 */
export function sendNativeBatch(
  deps: IngestDeps,
  target: IngestTarget,
  items: readonly unknown[],
  idempotencyKey?: string,
): Promise<IngestOutcome> {
  return runIdempotent(
    deps.db,
    target.workspaceId,
    idempotency('POST /v1/emails/batch', idempotencyKey, items),
    {
      prepare: async () => {
        const slots: Slot[] = []
        for (const [index, item] of items.entries()) {
          slots.push(await prepareItem(item, index, deps.maxMessageBytes))
        }
        return slots
      },
      persist: async (tx, slots) => {
        const ok = slots.flatMap((s) => ('prepared' in s ? [s.prepared] : []))
        await persistEmails(tx, target, ok, { idempotencyKey })
        const data: BatchItemResult[] = slots.map((s) =>
          'prepared' in s
            ? { ok: true, index: s.index, id: s.prepared.id }
            : { ok: false, index: s.index, error: s.error },
        )
        const allOk = data.every((d) => d.ok)
        return { status: allOk ? 200 : 207, body: { data } satisfies BatchResponse }
      },
    },
  )
}
