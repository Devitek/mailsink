import { newId } from '@mailsink/db'
import { DomainError } from '../errors'
import { composeEml } from './compose-eml'
import { type ExtractedLink, extractLinks } from './links'
import type { NormalizedEmail } from './normalize'

/** Default of `MAILSINK_MAX_MESSAGE_BYTES` (25 MB). */
export const DEFAULT_MAX_MESSAGE_BYTES = 25 * 1024 * 1024

/** An email ready to be stored: id, raw MIME and links computed outside any transaction. */
export interface PreparedEmail {
  id: string
  email: NormalizedEmail
  raw: Uint8Array
  links: ExtractedLink[]
  createdAt: Date
  /**
   * Initial `messages.simulation` (null by default). The demo seeder (#62) puts a temporary
   * rule set there (`{ rules }`), read by the settings planner for this message only.
   */
  simulation?: Record<string, unknown>
}

export interface PrepareOptions {
  maxMessageBytes: number
  now?: Date
}

export function payloadTooLarge(maxBytes: number): DomainError {
  return new DomainError('payload_too_large', `Message exceeds the ${maxBytes} bytes limit`, {
    details: { maxBytes },
  })
}

/**
 * CPU part of the pipeline: composes the raw EML when the dialect brought none (D9),
 * enforces the size cap on it (the size of what would go on the wire, attachments
 * included) and extracts the links. Throws `payload_too_large`.
 */
export async function prepareEmail(
  email: NormalizedEmail,
  options: PrepareOptions,
): Promise<PreparedEmail> {
  const createdAt = options.now ?? new Date()
  const id = newId('msg', createdAt.getTime())
  const attachmentBytes = email.attachments.reduce((sum, a) => sum + a.content.byteLength, 0)
  if (attachmentBytes > options.maxMessageBytes) throw payloadTooLarge(options.maxMessageBytes)
  const raw = email.raw ?? (await composeEml(email, { messageId: id, date: createdAt }))
  if (raw.byteLength > options.maxMessageBytes) throw payloadTooLarge(options.maxMessageBytes)
  return { id, email, raw, links: extractLinks(email.html, email.text), createdAt }
}
