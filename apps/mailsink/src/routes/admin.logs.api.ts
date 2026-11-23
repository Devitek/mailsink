import { createFileRoute } from '@tanstack/react-router'
import { listAdminApiLogsApi } from '../http/admin/logs'

export const Route = createFileRoute('/admin/logs/api')({
  server: { handlers: { GET: listAdminApiLogsApi } },
})
