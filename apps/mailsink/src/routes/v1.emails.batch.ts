import { createFileRoute } from '@tanstack/react-router'
import { postEmailBatch } from '../http/native/emails'

export const Route = createFileRoute('/v1/emails/batch')({
  server: { handlers: { POST: postEmailBatch } },
})
