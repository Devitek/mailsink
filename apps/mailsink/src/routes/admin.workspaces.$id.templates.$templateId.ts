import { createFileRoute } from '@tanstack/react-router'
import { deleteTemplate, getTemplate, patchTemplate } from '../http/admin/templates'

export const Route = createFileRoute('/admin/workspaces/$id/templates/$templateId')({
  server: { handlers: { GET: getTemplate, PATCH: patchTemplate, DELETE: deleteTemplate } },
})
