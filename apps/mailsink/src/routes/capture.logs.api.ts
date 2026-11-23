import { createFileRoute } from '@tanstack/react-router'
import { listApiLogsApi } from '../http/capture/logs'

export const Route = createFileRoute('/capture/logs/api')({
  server: { handlers: { GET: listApiLogsApi } },
})
