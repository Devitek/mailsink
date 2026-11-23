import { createFileRoute } from '@tanstack/react-router'
import { getOpenApi } from '../http/openapi'

export const Route = createFileRoute('/openapi.json')({
  server: { handlers: { GET: getOpenApi } },
})
