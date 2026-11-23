import { createFileRoute } from '@tanstack/react-router'
import { listDeliveriesApi } from '../http/capture/webhooks-deliveries'

export const Route = createFileRoute('/capture/webhooks/deliveries')({
  server: { handlers: { GET: listDeliveriesApi } },
})
