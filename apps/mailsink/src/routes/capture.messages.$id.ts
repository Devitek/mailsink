import { createFileRoute } from '@tanstack/react-router'
import { getMessage } from '../http/capture/api'

export const Route = createFileRoute('/capture/messages/$id')({
  server: { handlers: { GET: getMessage } },
})
