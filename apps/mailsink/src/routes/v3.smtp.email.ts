import { createFileRoute } from '@tanstack/react-router'
import { postBrevoEmail } from '../http/dialects/brevo/send'

export const Route = createFileRoute('/v3/smtp/email')({
  server: { handlers: { POST: postBrevoEmail } },
})
