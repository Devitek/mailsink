import { createFileRoute } from '@tanstack/react-router'
import { listSmtpSessionsApi } from '../http/capture/logs'

export const Route = createFileRoute('/capture/logs/smtp')({
  server: { handlers: { GET: listSmtpSessionsApi } },
})
