import { createFileRoute } from '@tanstack/react-router'
import { getAdminApiLogApi } from '../http/admin/logs'

export const Route = createFileRoute('/admin/logs/api/$id')({
  server: { handlers: { GET: getAdminApiLogApi } },
})
