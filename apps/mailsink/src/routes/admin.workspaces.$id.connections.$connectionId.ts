import { createFileRoute } from '@tanstack/react-router'
import { deleteConnection, patchConnection } from '../http/admin/connections'

export const Route = createFileRoute('/admin/workspaces/$id/connections/$connectionId')({
  server: { handlers: { PATCH: patchConnection, DELETE: deleteConnection } },
})
