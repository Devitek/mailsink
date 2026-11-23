import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import {
  getApiLogFn,
  getDeliveryFn,
  getSmtpSessionFn,
  listApiLogsFn,
  listDeliveriesFn,
  listSmtpSessionsFn,
  logSourcesFn,
} from '../../server-fns/logs-fns'
import type {
  ApiLogsQueryInput,
  DeliveriesQueryInput,
  SmtpSessionsQueryInput,
} from './search-query'

// TanStack Query options of the logs explorer (#41). Every key starts with ['logs', slug]
// then the tab: the workspace stream invalidates or updates them (apply-log-event.ts).

export const logsKey = (slug: string) => ['logs', slug] as const
export const logListKey = (slug: string, tab: 'api' | 'smtp' | 'webhooks') =>
  [...logsKey(slug), tab, 'list'] as const
export const logSourcesKey = (slug: string) => [...logsKey(slug), 'sources'] as const

/** Lists keep their page on screen while the next one loads (pager, filters). */
const list = { placeholderData: keepPreviousData, staleTime: Number.POSITIVE_INFINITY }
const detail = { staleTime: Number.POSITIVE_INFINITY, retry: false }

export const logSourcesQuery = (slug: string) =>
  queryOptions({
    queryKey: logSourcesKey(slug),
    queryFn: () => logSourcesFn({ data: { slug } }),
    staleTime: Number.POSITIVE_INFINITY,
  })

export const apiLogsQuery = (slug: string, query: ApiLogsQueryInput) =>
  queryOptions({
    queryKey: [...logListKey(slug, 'api'), query] as const,
    queryFn: () => listApiLogsFn({ data: { slug, query } }),
    ...list,
  })

export const apiLogQuery = (slug: string, id: string) =>
  queryOptions({
    queryKey: [...logsKey(slug), 'api', 'detail', id] as const,
    queryFn: () => getApiLogFn({ data: { slug, id } }),
    ...detail,
  })

export const smtpSessionsQuery = (slug: string, query: SmtpSessionsQueryInput) =>
  queryOptions({
    queryKey: [...logListKey(slug, 'smtp'), query] as const,
    queryFn: () => listSmtpSessionsFn({ data: { slug, query } }),
    ...list,
  })

export const smtpSessionQuery = (slug: string, id: string) =>
  queryOptions({
    queryKey: [...logsKey(slug), 'smtp', 'detail', id] as const,
    queryFn: () => getSmtpSessionFn({ data: { slug, id } }),
    ...detail,
  })

export const deliveriesQuery = (slug: string, query: DeliveriesQueryInput) =>
  queryOptions({
    queryKey: [...logListKey(slug, 'webhooks'), query] as const,
    queryFn: () => listDeliveriesFn({ data: { slug, query } }),
    ...list,
  })

export const deliveryKey = (slug: string, id: string) =>
  [...logsKey(slug), 'webhooks', 'detail', id] as const

export const deliveryQuery = (slug: string, id: string) =>
  queryOptions({
    queryKey: deliveryKey(slug, id),
    queryFn: () => getDeliveryFn({ data: { slug, id } }),
    ...detail,
  })
