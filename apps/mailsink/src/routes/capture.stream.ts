import { createFileRoute } from '@tanstack/react-router'
import { streamEvents } from '../http/capture/stream'

export const Route = createFileRoute('/capture/stream')({
  server: { handlers: { GET: streamEvents } },
})
