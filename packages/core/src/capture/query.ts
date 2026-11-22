import type { ListMessagesQuery } from '@mailsink/contracts'
import type { MessageSearch } from '@mailsink/db'
import { decodeCursor, queryError } from './cursor'

/** `name` or `name:value` (split on the first colon, so values may contain colons). */
export function parseTagFilter(tag: string): { name: string; value?: string } {
  const colon = tag.indexOf(':')
  return colon < 0 ? { name: tag } : { name: tag.slice(0, colon), value: tag.slice(colon + 1) }
}

/**
 * Turns the validated query string into repository filters for one workspace.
 * `wait=true` (long polling) lands with #26: until then it is refused with a 422
 * (`wait_not_supported`) rather than silently answering without waiting.
 */
export function toMessageSearch(workspaceId: string, query: ListMessagesQuery): MessageSearch {
  if (query.wait) {
    throw queryError('wait', 'wait_not_supported', 'wait=true is not supported yet')
  }
  return {
    workspaceId,
    to: query.to || undefined,
    from: query.from || undefined,
    subject: query.subject || undefined,
    tag: query.tag ? parseTagFilter(query.tag) : undefined,
    statuses: query.status,
    connectionId: query.connectionId,
    since: query.since ? new Date(query.since) : undefined,
    until: query.until ? new Date(query.until) : undefined,
    q: query.q?.trim() || undefined,
    after: query.cursor ? decodeCursor(query.cursor) : undefined,
    limit: query.limit,
  }
}
