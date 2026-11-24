import { createFileRoute } from '@tanstack/react-router'
import { getBrevoBlockedContacts } from '../http/dialects/brevo/read'

export const Route = createFileRoute('/v3/smtp/blockedContacts')({
  server: { handlers: { GET: getBrevoBlockedContacts } },
})
