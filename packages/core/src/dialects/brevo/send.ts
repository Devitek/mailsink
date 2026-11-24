import type { BrevoSendRequest, BrevoSendResponse } from '@mailsink/contracts'
import { findTemplateByExternalId } from '@mailsink/db'
import { publishAll, type StreamFrame } from '../../events/bus'
import { messageIdHeader } from '../../ingestion/compose-eml'
import { hashRequest, runIdempotent } from '../../ingestion/idempotency'
import type { IngestDeps, IngestOutcome } from '../../ingestion/native'
import type { IngestTarget } from '../../ingestion/normalize'
import { persistEmails } from '../../ingestion/pipeline'
import { type PreparedEmail, prepareEmail } from '../../ingestion/prepare'
import { brevoIdempotencyPolicy, brevoStoredKey } from './idempotency'
import { brevoFieldError, fromBrevoRequest } from './normalize'

const SCOPE = 'POST /v3/smtp/email'

async function prepareAll(
  deps: IngestDeps,
  target: IngestTarget,
  request: BrevoSendRequest,
): Promise<PreparedEmail[]> {
  let template = null
  if (request.templateId !== undefined) {
    template = await findTemplateByExternalId(deps.db, target.workspaceId, request.templateId)
    if (!template) {
      throw brevoFieldError(
        'templateId',
        'template_not_found',
        `Template ID ${request.templateId} does not exist`,
      )
    }
  }
  const prepared: PreparedEmail[] = []
  for (const email of fromBrevoRequest(request, template)) {
    const item = await prepareEmail(email, { maxMessageBytes: deps.maxMessageBytes })
    // Brevo answers the Message-ID header of the sent message (D58 shape).
    item.email.providerMessageId = messageIdHeader(item.id)
    prepared.push(item)
  }
  return prepared
}

/**
 * Brevo `POST /v3/smtp/email` (#29): one message per message version (or one message),
 * stored in one transaction through the shared pipeline with `source: 'brevo'`. Answers
 * 201 `{ messageId }`, or `{ messageIds }` (in version order) with `messageVersions`.
 * An `idempotencyKey` (read by readBrevoIdempotencyKey) is refused when reused within 30
 * minutes, whatever the body, as Brevo documents (D279).
 */
export async function sendBrevoEmail(
  deps: IngestDeps,
  target: IngestTarget,
  request: BrevoSendRequest,
  idempotencyKey?: string,
): Promise<IngestOutcome> {
  const frames: StreamFrame[] = []
  const outcome = await runIdempotent(
    deps.db,
    target.workspaceId,
    idempotencyKey
      ? {
          key: brevoStoredKey(target.connectionId, idempotencyKey),
          requestHash: hashRequest(SCOPE, request),
        }
      : undefined,
    {
      prepare: () => prepareAll(deps, target, request),
      persist: async (tx, prepared) => {
        frames.length = 0 // a retried transaction starts over
        const stored = await persistEmails(tx, target, prepared, { idempotencyKey, frames })
        const ids = stored.map((m) => m.providerMessageId)
        const body: BrevoSendResponse = request.messageVersions
          ? { messageIds: ids }
          : { messageId: ids[0] ?? '' }
        return { status: 201, body }
      },
    },
    idempotencyKey ? brevoIdempotencyPolicy(idempotencyKey) : undefined,
  )
  if (!outcome.replayed) publishAll(deps.bus, target.workspaceId, frames)
  return outcome
}
