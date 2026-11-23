import { createFileRoute } from '@tanstack/react-router'
import { testWebhookApi } from '../http/capture/webhooks'

// Escaped segment: a `.test.ts` file name would be collected as a Vitest file.
export const Route = createFileRoute('/capture/webhooks/$id/test')({
  server: { handlers: { POST: testWebhookApi } },
})
