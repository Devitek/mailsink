import type { ListWebhookDeliveriesResponse, StreamEvent } from '@mailsink/contracts'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { deliveryKey, logListKey, logSourcesKey, logsKey } from './queries'

// How the frames of the workspace stream reach the logs explorer cache (#41), called by the
// stream cache helper of the workspace layout (features/realtime). A delivery frame is
// written in place at once (status, attempts); every log frame then returns the keys to
// refetch, which the stream hook coalesces (250 ms). Reading the logs is never logged
// (D145), so a refetch cannot feed itself.

/** Writes a delivery view into every cached delivery page that shows it. */
export function writeDelivery(
  qc: QueryClient,
  slug: string,
  delivery: ListWebhookDeliveriesResponse['data'][number],
) {
  qc.setQueriesData<ListWebhookDeliveriesResponse>(
    { queryKey: logListKey(slug, 'webhooks') },
    (page) =>
      page?.data.some((row) => row.id === delivery.id)
        ? { ...page, data: page.data.map((row) => (row.id === delivery.id ? delivery : row)) }
        : page,
  )
}

export function applyLogEvent(qc: QueryClient, slug: string, event: StreamEvent): QueryKey[] {
  switch (event.type) {
    case 'log.api':
      return [logListKey(slug, 'api'), logSourcesKey(slug)]
    case 'log.smtp':
      return [logListKey(slug, 'smtp'), logSourcesKey(slug)]
    case 'webhook.delivery':
      writeDelivery(qc, slug, event.delivery)
      return [
        logListKey(slug, 'webhooks'),
        logSourcesKey(slug),
        deliveryKey(slug, event.delivery.id),
      ]
    case 'messages.purged':
      // `DELETE /capture/messages` deletes the logs too by default.
      return [logsKey(slug)]
    default:
      return []
  }
}
