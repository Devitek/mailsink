import { createFileRoute } from '@tanstack/react-router'

// Real-time events of the inbox (#39) for the signed-in browser: `GET /capture/stream`
// behind the UI session. The server module never reaches the client bundle.
export const Route = createFileRoute('/w/$workspaceSlug/m/stream')({
  server: {
    handlers: {
      GET: async ({ request, params }) =>
        (await import('../features/realtime/stream-route.server')).streamForSession(
          request,
          params.workspaceSlug,
        ),
    },
  },
})
