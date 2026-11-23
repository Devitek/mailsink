import type { EndpointSecrets, MessageForWebhook } from './types'

export const JSON_CONTENT_TYPE = 'application/json'

/** `Name <email>` when a display name is set, else the bare address (Resend style). */
export function formatAddress(a: { email: string; name?: string | null }): string {
  return a.name ? `${a.name} <${a.email}>` : a.email
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A UUID for the message: the provider id when it is one (Resend ingestion), else the
 * UUIDv7 body of the `msg_` id (D25).
 */
export function messageUuid(message: Pick<MessageForWebhook, 'id' | 'providerMessageId'>): string {
  if (UUID_RE.test(message.providerMessageId)) return message.providerMessageId
  return message.id.replace(/^msg_/, '')
}

/**
 * Custom headers first, then the format's own headers, which always win: a custom header
 * can never replace the content type, a signature or the Authorization header.
 */
export function withCustomHeaders(
  endpoint: Pick<EndpointSecrets, 'customHeaders'>,
  own: Record<string, string>,
): Record<string, string> {
  const ownNames = new Set(Object.keys(own).map((k) => k.toLowerCase()))
  const headers: Record<string, string> = {}
  for (const { key, value } of endpoint.customHeaders) {
    if (!ownNames.has(key.toLowerCase())) headers[key] = value
  }
  return { ...headers, ...own }
}

/** Unix seconds of a date. */
export const unixSeconds = (date: Date): number => Math.floor(date.getTime() / 1000)
