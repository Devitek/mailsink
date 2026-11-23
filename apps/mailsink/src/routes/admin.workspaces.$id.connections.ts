import { createFileRoute } from '@tanstack/react-router'
import { postConnection } from '../http/admin/connections'

export const Route = createFileRoute('/admin/workspaces/$id/connections')({
  server: { handlers: { POST: postConnection } },
})
