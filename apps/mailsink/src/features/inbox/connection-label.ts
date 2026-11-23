import type { ConnectionKind, MessageSummary } from '@mailsink/contracts'
import type { InboxConnectionFacet } from '@mailsink/core'

// Connection labels of the inbox: provider names, never translated, in their brand colour.

export const KIND_LABEL: Record<ConnectionKind, string> = {
  resend: 'Resend',
  brevo: 'Brevo',
  smtp: 'SMTP',
}

export const KIND_TEXT_CLASS: Record<ConnectionKind, string> = {
  resend: 'text-ms-conn-resend',
  brevo: 'text-ms-conn-brevo',
  smtp: 'text-ms-conn-smtp',
}

export type ConnectionInfo = { label: string; name: string | null; className: string }

/** Label of a message's connection; a deleted connection falls back on the source. */
export function connectionOf(
  message: Pick<MessageSummary, 'connectionId' | 'source'>,
  connections: readonly InboxConnectionFacet[] | undefined,
): ConnectionInfo {
  const found = connections?.find((c) => c.id === message.connectionId)
  if (found) {
    return {
      label: KIND_LABEL[found.kind],
      name: found.name,
      className: KIND_TEXT_CLASS[found.kind],
    }
  }
  const source = message.source
  return source === 'native'
    ? { label: 'API', name: null, className: 'text-ms-text-muted' }
    : { label: KIND_LABEL[source], name: null, className: KIND_TEXT_CLASS[source] }
}

/** Chip labels: the kind, plus the name when two connections share a kind. */
export function connectionChipLabel(
  connection: InboxConnectionFacet,
  all: readonly InboxConnectionFacet[],
): string {
  const shared = all.filter((c) => c.kind === connection.kind).length > 1
  return shared
    ? `${KIND_LABEL[connection.kind]} · ${connection.name}`
    : KIND_LABEL[connection.kind]
}
