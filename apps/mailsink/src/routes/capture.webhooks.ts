import { createFileRoute } from '@tanstack/react-router'
import { createWebhookApi, listWebhooksApi } from '../http/capture/webhooks'

export const Route = createFileRoute('/capture/webhooks')({
  server: { handlers: { GET: listWebhooksApi, POST: createWebhookApi } },
})
