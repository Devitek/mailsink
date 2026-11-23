import { createFileRoute } from '@tanstack/react-router'
import { deleteWorkspace, getWorkspace, patchWorkspace } from '../http/admin/workspaces'

export const Route = createFileRoute('/admin/workspaces/$id')({
  server: { handlers: { GET: getWorkspace, PATCH: patchWorkspace, DELETE: deleteWorkspace } },
})
