import { createFileRoute } from '@tanstack/react-router'
import { listMessages, purgeMessages } from '../http/capture/api'

export const Route = createFileRoute('/capture/messages')({
  server: { handlers: { GET: listMessages, DELETE: purgeMessages } },
})
