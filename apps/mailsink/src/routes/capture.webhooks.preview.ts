import { createFileRoute } from '@tanstack/react-router'
import { previewWebhookApi } from '../http/capture/webhooks'

export const Route = createFileRoute('/capture/webhooks/preview')({
  server: { handlers: { POST: previewWebhookApi } },
})
