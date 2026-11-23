import { createFileRoute } from '@tanstack/react-router'
import { rotateWorkspaceKeyApi } from '../http/admin/workspaces'

export const Route = createFileRoute('/admin/workspaces/$id/key/rotate')({
  server: { handlers: { POST: rotateWorkspaceKeyApi } },
})
