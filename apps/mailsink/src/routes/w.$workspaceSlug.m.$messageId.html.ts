import { createFileRoute } from '@tanstack/react-router'

// HTML body of the sandboxed preview iframe (#40), behind the UI session.
export const Route = createFileRoute('/w/$workspaceSlug/m/$messageId/html')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const scheme = new URL(request.url).searchParams.get('scheme') === 'dark' ? 'dark' : 'light'
        return (await import('../features/message-viewer/download-routes.server')).htmlForSession(
          params.workspaceSlug,
          params.messageId,
          scheme,
        )
      },
    },
  },
})
