import { createFileRoute } from '@tanstack/react-router'
import { deleteBrevoBlockedContact } from '../http/dialects/brevo/read'

export const Route = createFileRoute('/v3/smtp/blockedContacts/$email')({
  server: { handlers: { DELETE: deleteBrevoBlockedContact } },
})
