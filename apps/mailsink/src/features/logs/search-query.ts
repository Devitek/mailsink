import type {
  ListApiLogsQuery,
  ListSmtpSessionsQuery,
  ListWebhookDeliveriesQuery,
  LogsSearch,
  LogsSort,
  LogsTab,
} from '@mailsink/contracts'

// From the URL of the logs explorer (LogsSearch, #41) to the queries of the read services:
// defaults resolved here so links stay short, and the page reset when a filter changes.

export const DEFAULT_PAGE_SIZE = 50
export const PAGE_SIZES = [25, 50, 100, 200] as const
export const DEFAULT_SORT: LogsSort = '-createdAt'

type Input<T> = { [K in keyof T]?: T[K] }
export type ApiLogsQueryInput = Input<ListApiLogsQuery>
export type SmtpSessionsQueryInput = Input<ListSmtpSessionsQuery>
export type DeliveriesQueryInput = Input<ListWebhookDeliveriesQuery>

export const tabOf = (search: LogsSearch): LogsTab => search.tab ?? 'api'

/** Only the API table sorts on duration and status; SMTP sorts on its start time. */
export function sortOf(search: LogsSearch): LogsSort {
  const sort = search.sort ?? DEFAULT_SORT
  if (tabOf(search) !== 'api' && !sort.endsWith('createdAt')) return DEFAULT_SORT
  return sort
}

const paging = (search: LogsSearch) => ({
  page: search.page ?? 1,
  pageSize: search.pageSize ?? DEFAULT_PAGE_SIZE,
})

/** Drops undefined keys, so equal filters give equal query keys. */
function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T
}

/** Filters of the « More filters » popover (#112) shared by API and SMTP. */
const sharedMore = (search: LogsSearch) => ({
  messageId: search.messageId,
  since: search.since,
  until: search.until,
})

export function apiQueryOf(search: LogsSearch): ApiLogsQueryInput {
  return compact({
    connectionId: search.connectionId,
    dialect: search.dialect,
    status: search.code,
    path: search.q,
    method: search.method,
    errorCode: search.errorCode,
    ...sharedMore(search),
    sort: sortOf(search),
    ...paging(search),
  })
}

export function smtpQueryOf(search: LogsSearch): SmtpSessionsQueryInput {
  return compact({
    connectionId: search.connectionId,
    outcome: search.outcome,
    q: search.q,
    ...sharedMore(search),
    sort: sortOf(search) === 'createdAt' ? 'startedAt' : '-startedAt',
    ...paging(search),
  })
}

export function deliveriesQueryOf(search: LogsSearch): DeliveriesQueryInput {
  return compact({
    endpointId: search.endpointId,
    payloadFormat: search.format,
    status: search.delivery,
    messageId: search.messageId,
    limit: search.pageSize ?? DEFAULT_PAGE_SIZE,
    // Page numbers since #112; a cursor of an older link still opens its page.
    ...(search.cursor && !search.page ? { cursor: search.cursor } : { page: search.page ?? 1 }),
  })
}

/** Keys that change the rows shown: changing one goes back to the first page. */
const FILTER_KEYS = [
  'tab',
  'q',
  'connectionId',
  'dialect',
  'code',
  'outcome',
  'delivery',
  'format',
  'endpointId',
  'messageId',
  'since',
  'until',
  'method',
  'errorCode',
  'sort',
  'pageSize',
] as const

/** Applies a change to the URL; a filter change resets the page, the cursor and the sheet. */
export function changeSearch(prev: LogsSearch, change: Partial<LogsSearch>): LogsSearch {
  const next = { ...prev, ...change }
  if (FILTER_KEYS.some((key) => key in change && change[key] !== prev[key])) {
    next.page = undefined
    next.cursor = undefined
    if (!('inspect' in change)) next.inspect = undefined
  }
  if (change.tab !== undefined && change.tab !== prev.tab) {
    // Facets of one tab mean nothing on another.
    return compact({ tab: change.tab === 'api' ? undefined : change.tab, pageSize: prev.pageSize })
  }
  return compact(next)
}

/** The sort of the URL as TanStack Table sorting state (column ids are the API sort keys). */
export function sortingOf(sort: LogsSort): { id: string; desc: boolean }[] {
  return [{ id: sort.replace(/^-/, ''), desc: sort.startsWith('-') }]
}

const SORT_COLUMNS = new Set(['createdAt', 'durationMs', 'statusCode'])

/** Back from the table state to the URL; the default sort is left out of the URL. */
export function sortFromSorting(sorting: readonly { id: string; desc: boolean }[]) {
  const [first] = sorting
  if (!first || !SORT_COLUMNS.has(first.id)) return undefined
  const sort = (first.desc ? `-${first.id}` : first.id) as LogsSort
  return sort === DEFAULT_SORT ? undefined : sort
}
