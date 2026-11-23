import { createFileRoute } from '@tanstack/react-router'
import { postOverrideReset } from '../http/capture/override'

export const Route = createFileRoute('/capture/override/reset')({
  server: { handlers: { POST: postOverrideReset } },
})
