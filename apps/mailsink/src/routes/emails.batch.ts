import { createFileRoute } from '@tanstack/react-router'
import { postResendBatch } from '../http/dialects/resend/emails'

export const Route = createFileRoute('/emails/batch')({
  server: { handlers: { POST: postResendBatch } },
})
