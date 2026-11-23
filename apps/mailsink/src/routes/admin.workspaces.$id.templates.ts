import { createFileRoute } from '@tanstack/react-router'
import { listTemplates, postTemplate } from '../http/admin/templates'

export const Route = createFileRoute('/admin/workspaces/$id/templates')({
  server: { handlers: { GET: listTemplates, POST: postTemplate } },
})
