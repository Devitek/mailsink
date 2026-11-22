import { createFileRoute } from '@tanstack/react-router'
import { healthz } from '../http/health'

export const Route = createFileRoute('/healthz')({
  server: { handlers: { GET: healthz } },
})
