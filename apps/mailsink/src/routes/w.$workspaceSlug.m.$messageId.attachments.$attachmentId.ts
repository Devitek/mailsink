import { createFileRoute } from '@tanstack/react-router'

// Attachment download of the message viewer (#40), behind the UI session.
export const Route = createFileRoute('/w/$workspaceSlug/m/$messageId/attachments/$attachmentId')({
  server: {
    handlers: {
      GET: async ({ params }) =>
        (await import('../features/message-viewer/download-routes.server')).attachmentForSession(
          params.workspaceSlug,
          params.messageId,
          params.attachmentId,
        ),
    },
  },
})
