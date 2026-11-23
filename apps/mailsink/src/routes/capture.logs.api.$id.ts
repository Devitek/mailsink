import { createFileRoute } from '@tanstack/react-router'
import { getApiLogApi } from '../http/capture/logs'

export const Route = createFileRoute('/capture/logs/api/$id')({
  server: { handlers: { GET: getApiLogApi } },
})
