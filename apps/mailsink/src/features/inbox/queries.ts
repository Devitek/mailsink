import type { InboxPage } from '@mailsink/core'
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import {
  getMessageFn,
  getRawSourceFn,
  inboxFacetsFn,
  listInboxFn,
} from '../../server-fns/messages-fns'
import type { InboxFilters } from './search-query'

// TanStack Query options of the inbox (#39, #40). Every key starts with ['inbox', slug]: the
// stream updates or invalidates them (features/realtime), a purge resets them all.

export const inboxKey = (slug: string) => ['inbox', slug] as const

/** Filters without undefined keys, so equal filters give equal query keys. */
const keyOf = (f: InboxFilters): InboxFilters =>
  Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined)) as InboxFilters

export const inboxListQuery = (slug: string, filters: InboxFilters) =>
  infiniteQueryOptions({
    queryKey: [...inboxKey(slug), 'list', keyOf(filters)] as const,
    queryFn: ({ pageParam }): Promise<InboxPage> =>
      listInboxFn({ data: { slug, filters: keyOf(filters), cursor: pageParam } }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // The stream keeps the list fresh; a refetch on focus would reset the scroll for nothing.
    staleTime: Number.POSITIVE_INFINITY,
  })

export const facetsQuery = (slug: string) =>
  queryOptions({
    queryKey: [...inboxKey(slug), 'facets'] as const,
    queryFn: () => inboxFacetsFn({ data: { slug } }),
    staleTime: Number.POSITIVE_INFINITY,
  })

export const messageQuery = (slug: string, id: string) =>
  queryOptions({
    queryKey: [...inboxKey(slug), 'message', id] as const,
    queryFn: () => getMessageFn({ data: { slug, id } }),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  })

export const rawSourceQuery = (slug: string, id: string) =>
  queryOptions({
    queryKey: [...inboxKey(slug), 'raw', id] as const,
    queryFn: () => getRawSourceFn({ data: { slug, id } }),
    staleTime: Number.POSITIVE_INFINITY,
  })
