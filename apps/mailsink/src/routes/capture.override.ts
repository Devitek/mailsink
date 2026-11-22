import { createFileRoute } from '@tanstack/react-router'
import { getOverride, postOverride } from '../http/capture/override'

export const Route = createFileRoute('/capture/override')({
  server: { handlers: { GET: getOverride, POST: postOverride } },
})
