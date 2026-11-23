import type { Readable } from 'node:stream'
import {
  type EventBus,
  fromSmtpMessage,
  isDomainError,
  persistEmails,
  prepareEmail,
  publishAll,
  type SmtpEnvelope,
  type SmtpReply,
  type StreamFrame,
} from '@mailsink/core'
import type { Database } from '@mailsink/db'
import type { SmtpUser } from './auth'

export interface IngestDeps {
  db: Database
  bus?: EventBus
  maxMessageBytes: number
}

/** A refused `DATA`, thrown with the reply smtp-server sends. */
export class SmtpReplyError extends Error {
  readonly responseCode: number
  constructor(reply: SmtpReply) {
    super(reply.message)
    this.responseCode = reply.responseCode
  }
}

export const tooLarge = (maxBytes: number): SmtpReply => ({
  responseCode: 552,
  message: `5.3.4 Message exceeds the ${maxBytes} bytes limit`,
})

export const LOCAL_ERROR: SmtpReply = {
  responseCode: 451,
  message: '4.3.0 Local error in processing',
}

/** Reads the message; past the cap the rest is drained, not buffered. */
export async function readMessage(
  stream: Readable & { sizeExceeded?: boolean },
  maxBytes: number,
): Promise<Uint8Array> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of stream) {
    size += (chunk as Buffer).byteLength
    if (size <= maxBytes) chunks.push(chunk as Buffer)
  }
  if (size > maxBytes || stream.sizeExceeded) throw new SmtpReplyError(tooLarge(maxBytes))
  const raw = Buffer.concat(chunks)
  return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)
}

/**
 * `DATA` of an authenticated session: mailparser to NormalizedEmail with the raw EML kept
 * (D9), then the shared pipeline (source `smtp`): suppressed recipients are accepted and
 * marked `suppressed`, frames are published once committed (D6). Resolves with the message id.
 */
export async function ingestSmtpMessage(
  deps: IngestDeps,
  user: SmtpUser,
  raw: Uint8Array,
  envelope: SmtpEnvelope,
): Promise<string> {
  try {
    const email = await fromSmtpMessage(raw, envelope)
    const prepared = await prepareEmail(email, { maxMessageBytes: deps.maxMessageBytes })
    const frames: StreamFrame[] = []
    const target = { workspaceId: user.workspaceId, connectionId: user.connectionId }
    await deps.db.transaction(async (tx) => {
      frames.length = 0 // a retried transaction starts over
      await persistEmails(tx, { ...target, source: 'smtp' }, [prepared], { frames })
    })
    publishAll(deps.bus, user.workspaceId, frames)
    return prepared.id
  } catch (error) {
    if (!isDomainError(error)) throw error
    if (error.code === 'payload_too_large') throw new SmtpReplyError(tooLarge(deps.maxMessageBytes))
    throw new SmtpReplyError({ responseCode: 550, message: `5.6.0 ${error.message}` })
  }
}
