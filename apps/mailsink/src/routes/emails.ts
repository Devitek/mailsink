import { createFileRoute } from '@tanstack/react-router'
import { postResendEmail } from '../http/dialects/resend/emails'

export const Route = createFileRoute('/emails')({
  server: { handlers: { POST: postResendEmail } },
})
