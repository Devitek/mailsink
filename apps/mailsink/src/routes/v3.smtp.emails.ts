import { createFileRoute } from '@tanstack/react-router'
import { getBrevoEmails } from '../http/dialects/brevo/read'

export const Route = createFileRoute('/v3/smtp/emails')({
  server: { handlers: { GET: getBrevoEmails } },
})
