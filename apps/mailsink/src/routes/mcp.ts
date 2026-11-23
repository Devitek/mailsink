import { createFileRoute } from '@tanstack/react-router'
import { mcpApi } from '../http/mcp'

export const Route = createFileRoute('/mcp')({
  server: { handlers: { POST: mcpApi, GET: mcpApi, DELETE: mcpApi } },
})
