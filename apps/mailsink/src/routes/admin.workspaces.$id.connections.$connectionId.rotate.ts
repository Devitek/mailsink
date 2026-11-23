import { createFileRoute } from '@tanstack/react-router'
import { rotateConnection } from '../http/admin/connections'

export const Route = createFileRoute('/admin/workspaces/$id/connections/$connectionId/rotate')({
  server: { handlers: { POST: rotateConnection } },
})
