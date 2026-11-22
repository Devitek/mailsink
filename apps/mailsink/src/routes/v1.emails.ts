import { createFileRoute } from '@tanstack/react-router'
import { postEmail } from '../http/native/emails'

export const Route = createFileRoute('/v1/emails')({
  server: { handlers: { POST: postEmail } },
})
