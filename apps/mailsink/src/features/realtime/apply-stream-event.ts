import type { DeliveryStatus, StreamEvent } from '@mailsink/contracts'
import type { InboxPage, InboxRow } from '@mailsink/core'
import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query'
import type { ViewerMessage } from '../../server-fns/messages-types'
import type { WorkspaceSummary } from '../../server-fns/workspace-types'
import { inboxKey } from '../inbox/queries'
import { type InboxFilters, matchesFilters } from '../inbox/search-query'
import { applyLogEvent } from '../logs/apply-log-event'
import { setOverrideState } from '../override/queries'
import { suppressionsKey } from '../suppressions/queries'

// How one stream frame changes the TanStack Query cache of the inbox (#39). Cheap changes
// are written in place (a new row, a status); the rest is returned as keys to invalidate,
// which the hook coalesces.

type ListData = InfiniteData<InboxPage, string | undefined>

export interface StreamEffects {
  /** Query keys to refetch (only the observed ones actually refetch). */
  invalidate: QueryKey[]
  /** Rows inserted without their body preview, to fetch. */
  previews: string[]
  /** The workspace was deleted: the stream is over. */
  deleted: boolean
}

const listKey = (slug: string) => [...inboxKey(slug), 'list']
const messagesKey = (slug: string) => [...inboxKey(slug), 'message']
const facetsKey = (slug: string) => [...inboxKey(slug), 'facets']

function mapRows(data: ListData, change: (row: InboxRow) => InboxRow): ListData {
  return { ...data, pages: data.pages.map((p) => ({ ...p, data: p.data.map(change) })) }
}

function setStatus(qc: QueryClient, slug: string, id: string, status: DeliveryStatus) {
  qc.setQueriesData<ListData>({ queryKey: listKey(slug) }, (data) =>
    data ? mapRows(data, (row) => (row.id === id ? { ...row, status } : row)) : data,
  )
  qc.setQueryData<ViewerMessage>([...messagesKey(slug), id], (m) => (m ? { ...m, status } : m))
}

/** Prepends a new message to every cached list it belongs to. */
function insertRow(qc: QueryClient, slug: string, row: InboxRow, effects: StreamEffects) {
  for (const query of qc.getQueryCache().findAll({ queryKey: listKey(slug) })) {
    const filters = (query.queryKey[3] ?? {}) as InboxFilters
    const matches = matchesFilters(filters, row)
    if (matches === undefined) effects.invalidate.push(query.queryKey)
    if (!matches) continue
    qc.setQueryData<ListData>(query.queryKey, (data) => {
      if (!data || data.pages.some((p) => p.data.some((r) => r.id === row.id))) return data
      const [first, ...rest] = data.pages
      return first ? { ...data, pages: [{ ...first, data: [row, ...first.data] }, ...rest] } : data
    })
  }
}

/** Statuses that put the address on the suppression list (simulation/recorder.ts). */
const SUPPRESSING = new Set<DeliveryStatus>(['hard_bounce', 'complained'])

/**
 * An ingestion or an authenticated API call touched the workspace (D16): the idle TTL of an
 * ephemeral workspace starts over, so its banner countdown does too. Never moved back.
 */
export function refreshExpiry(qc: QueryClient, slug: string, now = Date.now()) {
  qc.setQueryData<WorkspaceSummary | null>(['workspace', slug], (w) => {
    if (!w?.ephemeral || !w.idleTtlSeconds || !w.expiresAt) return w
    const next = now + w.idleTtlSeconds * 1000
    return next > Date.parse(w.expiresAt) ? { ...w, expiresAt: new Date(next).toISOString() } : w
  })
}

export function applyStreamEvent(qc: QueryClient, slug: string, event: StreamEvent): StreamEffects {
  const effects: StreamEffects = { invalidate: [], previews: [], deleted: false }
  switch (event.type) {
    case 'message.created':
      insertRow(qc, slug, { ...event.message, preview: '' }, effects)
      effects.previews.push(event.message.id)
      effects.invalidate.push(facetsKey(slug))
      refreshExpiry(qc, slug)
      break
    case 'message.status':
      // Per recipient statuses arrive as message.event; this one is the aggregate.
      if (event.recipient === null) setStatus(qc, slug, event.messageId, event.status)
      effects.invalidate.push(facetsKey(slug), [...messagesKey(slug), event.messageId])
      if (SUPPRESSING.has(event.status)) effects.invalidate.push(suppressionsKey(slug))
      break
    case 'message.event':
      effects.invalidate.push([...messagesKey(slug), event.messageId])
      break
    case 'webhook.delivery':
      if (event.delivery.messageId) {
        effects.invalidate.push([...messagesKey(slug), event.delivery.messageId])
      }
      effects.invalidate.push(facetsKey(slug))
      break
    case 'log.api':
      refreshExpiry(qc, slug)
      effects.invalidate.push(facetsKey(slug))
      break
    case 'log.smtp':
      effects.invalidate.push(facetsKey(slug))
      break
    case 'messages.purged':
      effects.invalidate.push(inboxKey(slug))
      break
    case 'workspace.deleted':
      effects.deleted = true
      break
    case 'override.changed':
      setOverrideState(qc, slug, event.state)
      break
  }
  // The logs explorer (#41) keeps its own cache: log, delivery and purge frames.
  effects.invalidate.push(...applyLogEvent(qc, slug, event))
  return effects
}

/** Fills the previews fetched after a `message.created`. */
export function applyPreviews(qc: QueryClient, slug: string, previews: Record<string, string>) {
  qc.setQueriesData<ListData>({ queryKey: listKey(slug) }, (data) =>
    data
      ? mapRows(data, (row) =>
          previews[row.id] !== undefined ? { ...row, preview: previews[row.id] ?? '' } : row,
        )
      : data,
  )
}
