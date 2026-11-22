import { createFileRoute } from '@tanstack/react-router'
import { health } from '../http/health'

export const Route = createFileRoute('/healthz')({
  server: {
    handlers: {
      GET: () => Response.json(health()),
    },
  },
})
