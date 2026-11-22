import { createFileRoute } from '@tanstack/react-router'
import { getAttachment } from '../capture/api'

export const Route = createFileRoute('/capture/messages/$id/attachments/$attId')({
  server: { handlers: { GET: getAttachment } },
})
