import { createFileRoute } from '@tanstack/react-router'
import { listWorkspaces, postWorkspace } from '../http/admin/workspaces'

export const Route = createFileRoute('/admin/workspaces')({
  server: { handlers: { GET: listWorkspaces, POST: postWorkspace } },
})
