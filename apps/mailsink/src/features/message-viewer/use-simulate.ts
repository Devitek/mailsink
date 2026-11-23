import { useLingui } from '@lingui/react/macro'
import type { TriggerEventRequest } from '@mailsink/contracts'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { triggerEventFn } from '../../server-fns/events-fns'
import { messageQuery } from '../inbox/queries'

/**
 * « Simulate » of the viewer (#40): the manual events API through a server function, then
 * the message refetched (the stream also pushes the change to every other open view).
 * `feedback` is the line announced after the last attempt.
 */
export function useSimulate(slug: string, messageId: string) {
  const { t } = useLingui()
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: (event: TriggerEventRequest) =>
      triggerEventFn({ data: { slug, id: messageId, event } }),
    onSettled: () => qc.invalidateQueries({ queryKey: messageQuery(slug, messageId).queryKey }),
  })
  const done = mutation.data
  const events = done?.events.length ?? 0
  const deliveries = done?.webhookDeliveries.length ?? 0
  const feedback = mutation.isError
    ? t`Simulation refused: ${mutation.error.message}`
    : done
      ? t`Events recorded: ${events}. Webhook deliveries queued: ${deliveries}.`
      : ''
  return {
    simulate: (event: TriggerEventRequest) => mutation.mutate(event),
    pending: mutation.isPending,
    feedback,
    failed: mutation.isError,
  }
}
