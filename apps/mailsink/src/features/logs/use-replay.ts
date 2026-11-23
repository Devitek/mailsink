import type {
  ListWebhookDeliveriesResponse,
  ReplayMode,
  WebhookDeliveryView,
} from '@mailsink/contracts'
import { type QueryKey, useMutation, useQueryClient } from '@tanstack/react-query'
import { replayDeliveryFn } from '../../server-fns/logs-fns'
import { logListKey, logSourcesKey } from './queries'
import type { DeliveriesQueryInput } from './search-query'

// Optimistic webhook replay (#41, D139): the pending replay shows at the top of the
// delivery tables at once, is swapped for the real row when the server answers, and
// removed again if the replay is refused. The stream then moves it through its attempts.

export const PLACEHOLDER_PREFIX = 'whd_pending-'

/** The row a replay of `source` will create, before the server names it. */
export function placeholderReplay(
  source: WebhookDeliveryView,
  mode: ReplayMode,
  now = Date.now(),
): WebhookDeliveryView {
  return {
    ...source,
    id: `${PLACEHOLDER_PREFIX}${now}`,
    status: 'pending',
    attemptCount: 0,
    nextAttemptAt: null,
    lastStatusCode: null,
    replayOf: source.replayOf ?? source.id,
    replayMode: mode,
    createdAt: new Date(now).toISOString(),
  }
}

/** Prepends the row to a first page whose filters it matches; other pages are left alone. */
export function withReplay(
  page: ListWebhookDeliveriesResponse | undefined,
  query: DeliveriesQueryInput,
  row: WebhookDeliveryView,
): ListWebhookDeliveriesResponse | undefined {
  if (!page || query.cursor || (query.page ?? 1) > 1) return page
  if (query.messageId && query.messageId !== row.messageId) return page
  if (query.status && query.status !== row.status) return page
  if (query.endpointId && query.endpointId !== row.endpointId) return page
  if (query.payloadFormat && query.payloadFormat !== row.payloadFormat) return page
  return { ...page, data: [row, ...page.data], total: page.total + 1 }
}

export function useReplay(slug: string) {
  const qc = useQueryClient()
  const lists = logListKey(slug, 'webhooks')
  const replaceRow = (id: string, row: WebhookDeliveryView | null) =>
    qc.setQueriesData<ListWebhookDeliveriesResponse>({ queryKey: lists }, (page) =>
      page
        ? {
            ...page,
            data: page.data.flatMap((d) => (d.id === id ? (row ? [row] : []) : [d])),
          }
        : page,
    )

  return useMutation({
    mutationFn: ({ source, mode }: { source: WebhookDeliveryView; mode: ReplayMode }) =>
      replayDeliveryFn({ data: { slug, id: source.id, request: { mode } } }),
    onMutate: async ({ source, mode }) => {
      await qc.cancelQueries({ queryKey: lists })
      const row = placeholderReplay(source, mode)
      for (const query of qc.getQueryCache().findAll({ queryKey: lists })) {
        const filters = (query.queryKey[4] ?? {}) as DeliveriesQueryInput
        qc.setQueryData<ListWebhookDeliveriesResponse>(query.queryKey as QueryKey, (page) =>
          withReplay(page, filters, row),
        )
      }
      return { placeholder: row.id }
    },
    onError: (_error, _vars, context) => {
      if (context) replaceRow(context.placeholder, null)
    },
    onSuccess: (replay, _vars, context) => {
      if (context) replaceRow(context.placeholder, replay)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: lists })
      void qc.invalidateQueries({ queryKey: logSourcesKey(slug) })
    },
  })
}
