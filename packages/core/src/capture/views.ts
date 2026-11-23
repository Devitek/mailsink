import type {
  Address,
  AddressOut,
  MessageDetail,
  MessageSummary,
  WebhookDeliveryView,
} from '@mailsink/contracts'
import type { AttachmentRow, MessageEventRow, MessageRow, RecipientRow } from '@mailsink/db'

/** Capture paths, relative to the server base URL. */
export const capturePaths = {
  raw: (messageId: string) => `/capture/messages/${messageId}/raw`,
  attachment: (messageId: string, attachmentId: string) =>
    `/capture/messages/${messageId}/attachments/${attachmentId}`,
}

const out = (a: { email: string; name?: string | null }): AddressOut => ({
  email: a.email,
  name: a.name ?? null,
})

const byKind = (recipients: RecipientRow[], kind: RecipientRow['kind']) =>
  recipients.filter((r) => r.kind === kind).map(out)

export function toSummary(
  m: MessageRow & { hasAttachments: boolean },
  recipients: RecipientRow[],
): MessageSummary {
  return {
    id: m.id,
    connectionId: m.connectionId,
    source: m.source,
    from: out(m.from),
    to: byKind(recipients, 'to'),
    subject: m.subject,
    status: m.status,
    tags: m.tags,
    hasAttachments: m.hasAttachments,
    createdAt: m.createdAt.toISOString(),
  }
}

export interface DetailParts {
  message: MessageRow & { hasAttachments: boolean }
  recipients: RecipientRow[]
  attachments: AttachmentRow[]
  events: MessageEventRow[]
  /** Webhook deliveries of the message, newest first (#33). */
  webhookDeliveries?: WebhookDeliveryView[]
}

/** `MessageDetail` (kept as an alias for existing callers). */
export type CapturedMessageDetail = MessageDetail

export function toDetail({
  message: m,
  recipients,
  attachments,
  events,
  webhookDeliveries = [],
}: DetailParts): CapturedMessageDetail {
  return {
    ...toSummary(m, recipients),
    cc: byKind(recipients, 'cc'),
    bcc: byKind(recipients, 'bcc'),
    replyTo: (m.replyTo ?? []).map((a: Address) => out(a)),
    html: m.html,
    text: m.text,
    headers: m.headers,
    metadata: m.metadata ?? {},
    links: m.links,
    attachments: attachments.map((a) => ({
      id: a.id,
      filename: a.filename,
      contentType: a.contentType,
      contentId: a.contentId,
      sizeBytes: a.sizeBytes,
      inline: a.disposition === 'inline',
      downloadUrl: capturePaths.attachment(m.id, a.id),
    })),
    recipients: recipients.map((r) => ({
      email: r.email,
      name: r.name,
      kind: r.kind,
      status: r.status,
      reason: r.statusReason,
    })),
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      origin: e.origin,
      recipient: e.recipientEmail,
      data: e.data ?? {},
      occurredAt: e.occurredAt.toISOString(),
    })),
    rawUrl: capturePaths.raw(m.id),
    simulation: m.simulation,
    webhookDeliveries,
  }
}
