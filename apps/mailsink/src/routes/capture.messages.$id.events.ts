import { createFileRoute } from '@tanstack/react-router'
import { postMessageEventApi } from '../http/capture/events'

export const Route = createFileRoute('/capture/messages/$id/events')({
  server: { handlers: { POST: postMessageEventApi } },
})
