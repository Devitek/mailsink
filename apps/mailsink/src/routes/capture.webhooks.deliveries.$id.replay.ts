import { createFileRoute } from '@tanstack/react-router'
import { replayDeliveryApi } from '../http/capture/webhooks-deliveries'

export const Route = createFileRoute('/capture/webhooks/deliveries/$id/replay')({
  server: { handlers: { POST: replayDeliveryApi } },
})
