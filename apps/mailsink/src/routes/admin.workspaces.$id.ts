import { createFileRoute } from '@tanstack/react-router'
import { deleteWorkspace, getWorkspace } from '../http/admin/workspaces'

export const Route = createFileRoute('/admin/workspaces/$id')({
  server: { handlers: { GET: getWorkspace, DELETE: deleteWorkspace } },
})
