import type { NewAttachment, NewMessageEvent, NewMessageRecipient } from '@mailsink/db'
import type { StreamFrame } from '../events/bus'
import { createdFrame, eventFrame } from '../events/frames'
import type { IngestTarget, NormalizedEmail } from './normalize'

export interface IngestedParts {
  id: string
  target: IngestTarget
  email: NormalizedEmail
  recipients: NewMessageRecipient[]
  attachmentRows: NewAttachment[]
  status: 'queued' | 'suppressed'
  createdAt: Date
  /** `accepted` first, then one `suppressed` per suppressed recipient. */
  events: (NewMessageEvent & { id: string })[]
}

/**
 * Stream frames of one stored message, built from what the pipeline already holds (no
 * query): `message.created` with the `accepted` event id, then one `message.event` per
 * `suppressed` event (D80).
 */
export function ingestionFrames(p: IngestedParts): StreamFrame[] {
  const [accepted, ...others] = p.events
  if (!accepted) return []
  const connectionId = p.target.connectionId
  const created = createdFrame(accepted.id, {
    id: p.id,
    connectionId,
    source: p.target.source,
    from: { email: p.email.from.email, name: p.email.from.name ?? null },
    to: p.recipients
      .filter((r) => r.kind === 'to')
      .map((r) => ({ email: r.email, name: r.name ?? null })),
    subject: p.email.subject,
    status: p.status,
    tags: p.email.tags,
    hasAttachments: p.attachmentRows.some((a) => a.disposition === 'attachment'),
    createdAt: p.createdAt.toISOString(),
  })
  return [
    created,
    ...others.map((e) =>
      eventFrame(
        {
          id: e.id,
          workspaceId: e.workspaceId,
          messageId: e.messageId,
          recipientEmail: e.recipientEmail ?? null,
          type: e.type,
          origin: e.origin,
          data: e.data ?? null,
          occurredAt: e.occurredAt ?? p.createdAt,
        },
        connectionId,
      ),
    ),
  ]
}
