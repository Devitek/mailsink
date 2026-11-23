import { createFileRoute } from '@tanstack/react-router'
import { getResendEmailRoute } from '../http/dialects/resend/emails'

export const Route = createFileRoute('/emails/$id')({
  server: { handlers: { GET: getResendEmailRoute } },
})
