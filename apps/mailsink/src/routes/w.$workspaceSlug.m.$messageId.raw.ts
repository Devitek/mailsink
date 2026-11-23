import { createFileRoute } from '@tanstack/react-router'

// Raw EML download of the message viewer (#40), behind the UI session.
export const Route = createFileRoute('/w/$workspaceSlug/m/$messageId/raw')({
  server: {
    handlers: {
      GET: async ({ params }) =>
        (await import('../features/message-viewer/download-routes.server')).rawForSession(
          params.workspaceSlug,
          params.messageId,
        ),
    },
  },
})
