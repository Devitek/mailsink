import { createFileRoute } from '@tanstack/react-router'
import { getSmtpSessionApi } from '../http/capture/logs'

export const Route = createFileRoute('/capture/logs/smtp/$id')({
  server: { handlers: { GET: getSmtpSessionApi } },
})
