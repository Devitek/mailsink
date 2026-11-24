import type { Address, EventType, ResendEmail, ResendLastEvent } from '@mailsink/contracts'
import {
  type Database,
  findWorkspaceMessage,
  listMessageEvents,
  listRecipients,
} from '@mailsink/db'
import { DomainError } from '../errors'
import { messageIdHeader } from '../ingestion/compose-eml'
import { messageIdOfResend, resendIdOf } from './resend-ingest'

/** Message event to Resend `last_event` (D22: soft bounces are `delivery_delayed`). */
const LAST_EVENT: Record<EventType, ResendLastEvent> = {
  accepted: 'queued',
  sent: 'sent',
  delivered: 'delivered',
  deferred: 'delivery_delayed',
  soft_bounce: 'delivery_delayed',
  hard_bounce: 'bounced',
  complained: 'complained',
  failed: 'failed',
  invalid: 'failed',
  suppressed: 'suppressed',
  opened: 'opened',
  clicked: 'clicked',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const formatAddress = (a: { email: string; name?: string | null }) =>
  a.name ? `${a.name} <${a.email}>` : a.email

/** "2026-04-03 22:13:42.674+00", the timestamp format of the Resend API. */
export function resendTimestamp(date: Date): string {
  return `${date.toISOString().replace('T', ' ').replace('Z', '')}+00`
}

/**
 * `GET /emails/:id`: a message of the workspace by its Resend id, any source (D121).
 * A malformed id is Resend's `422 invalid_parameter`, an unknown one `404 not_found`.
 */
/**
 * `Message-ID` the recipient saw: the one an SMTP client wrote itself (kept in `headers`),
 * else the one Mailsink composed for an API message.
 */
function messageIdOf(message: { id: string; source: string; headers: Record<string, string> }) {
  const own = message.source === 'smtp' ? message.headers['message-id']?.trim() : undefined
  return own || messageIdHeader(message.id)
}

export async function getResendEmail(
  db: Database,
  workspaceId: string,
  resendId: string,
): Promise<ResendEmail> {
  if (!UUID_RE.test(resendId)) {
    throw new DomainError('validation_error', 'The `id` must be a valid UUID.', {
      details: { resend: 'invalid_parameter' },
    })
  }
  const message = await findWorkspaceMessage(db, workspaceId, messageIdOfResend(resendId))
  if (!message) throw new DomainError('not_found', 'Email not found')
  const [recipients, events] = await Promise.all([
    listRecipients(db, [message.id]),
    listMessageEvents(db, message.id),
  ])
  const of = (kind: 'to' | 'cc' | 'bcc') =>
    recipients.filter((r) => r.kind === kind).map(formatAddress)
  const last = events.at(-1)
  return {
    object: 'email',
    id: resendIdOf(message.id),
    message_id: messageIdOf(message),
    to: of('to'),
    from: formatAddress(message.from as Address),
    created_at: resendTimestamp(message.createdAt),
    subject: message.subject,
    html: message.html,
    text: message.text,
    bcc: of('bcc'),
    cc: of('cc'),
    reply_to: (message.replyTo ?? []).map(formatAddress),
    last_event: last ? LAST_EVENT[last.type] : 'queued',
    scheduled_at: null,
    tags: message.tags,
  }
}
