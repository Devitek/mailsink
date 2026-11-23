import { createFileRoute } from '@tanstack/react-router'
import { getDeliveryApi } from '../http/capture/webhooks-deliveries'

export const Route = createFileRoute('/capture/webhooks/deliveries/$id')({
  server: { handlers: { GET: getDeliveryApi } },
})
