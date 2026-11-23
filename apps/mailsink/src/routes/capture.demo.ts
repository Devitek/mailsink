import { createFileRoute } from '@tanstack/react-router'
import { seedDemoApi } from '../http/capture/demo'

export const Route = createFileRoute('/capture/demo')({
  server: { handlers: { POST: seedDemoApi } },
})
