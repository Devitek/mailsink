import type { InboxSearch, MessageSummary } from '@mailsink/contracts'

// From the inbox URL filters to the Capture list query, on both sides of the wire.

export type InboxFilters = Pick<InboxSearch, 'q' | 'status' | 'connectionId' | 'tag'>

export type SearchBoxQuery = { q?: string; to?: string; from?: string }

const OPERATOR = /\b(to|from):(?:"([^"]*)"|(\S+))/gi

/**
 * The search box: `to:` and `from:` operators filter recipients and sender by substring;
 * a lone word with an `@` (`@acme.io`, `jane@`) searches recipients too; anything else is
 * the Capture full text search on subject and bodies.
 */
export function parseSearchBox(input: string | undefined): SearchBoxQuery {
  if (!input) return {}
  const result: SearchBoxQuery = {}
  const rest = input
    .replace(OPERATOR, (_, op: string, quoted?: string, bare?: string) => {
      const value = (quoted ?? bare ?? '').trim()
      if (value) result[op.toLowerCase() as 'to' | 'from'] = value
      return ' '
    })
    .replace(/\s+/g, ' ')
    .trim()
  if (rest && !result.to && /^\S*@\S*$/.test(rest)) result.to = rest
  else if (rest) result.q = rest
  return result
}

export function inboxFilters(search: InboxSearch): InboxFilters {
  const { q, status, connectionId, tag } = search
  return { q, status, connectionId, tag }
}

export const hasFilters = (f: InboxFilters): boolean =>
  Boolean(f.q || f.status || f.connectionId || f.tag)

/** `ListMessagesQuery` input of one inbox page. */
export function toListQuery(filters: InboxFilters, cursor: string | undefined, limit: number) {
  return {
    ...parseSearchBox(filters.q),
    ...(filters.status ? { status: [filters.status] } : {}),
    ...(filters.connectionId ? { connectionId: filters.connectionId } : {}),
    ...(filters.tag ? { tag: filters.tag } : {}),
    ...(cursor ? { cursor } : {}),
    limit,
  }
}

function tagMatches(tag: string, tags: MessageSummary['tags']): boolean {
  const colon = tag.indexOf(':')
  const name = colon < 0 ? tag : tag.slice(0, colon)
  const value = colon < 0 ? undefined : tag.slice(colon + 1)
  return tags.some((t) => t.name === name && (value === undefined || t.value === value))
}

/**
 * Whether a message pushed by the stream belongs to a filtered list: true or false when the
 * browser can tell (status, connection, tag), undefined when only the server can (search).
 */
export function matchesFilters(filters: InboxFilters, m: MessageSummary): boolean | undefined {
  if (filters.status && m.status !== filters.status) return false
  if (filters.connectionId && m.connectionId !== filters.connectionId) return false
  if (filters.tag && !tagMatches(filters.tag, m.tags)) return false
  return filters.q ? undefined : true
}
