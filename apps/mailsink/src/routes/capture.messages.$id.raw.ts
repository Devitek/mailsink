import { createFileRoute } from '@tanstack/react-router'
import { getRawMessage } from '../capture/api'

export const Route = createFileRoute('/capture/messages/$id/raw')({
  server: { handlers: { GET: getRawMessage } },
})
