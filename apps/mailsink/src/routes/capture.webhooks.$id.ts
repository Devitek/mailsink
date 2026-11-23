import { createFileRoute } from '@tanstack/react-router'
import { deleteWebhookApi, getWebhookApi, patchWebhookApi } from '../http/capture/webhooks'

export const Route = createFileRoute('/capture/webhooks/$id')({
  server: { handlers: { GET: getWebhookApi, PATCH: patchWebhookApi, DELETE: deleteWebhookApi } },
})
