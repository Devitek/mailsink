import { openEventStream } from '../../http/capture/stream-sse'
import { sessionWorkspace } from '../inbox/session-workspace.server'

/**
 * `GET /w/$workspaceSlug/m/stream`: the `GET /capture/stream` events of the workspace for
 * the signed-in browser (EventSource sends cookies, not a Bearer key). `Last-Event-ID` comes
 * from the browser's own reconnection, or from `?lastEventId=` when the inbox reopens the
 * stream itself after the browser gave up.
 */
export async function streamForSession(request: Request, slug: string): Promise<Response> {
  const resolved = await sessionWorkspace(slug)
  if (resolved instanceof Response) return resolved
  const { runtime, workspace } = resolved
  const lastEventId =
    request.headers.get('last-event-id') ?? new URL(request.url).searchParams.get('lastEventId')
  return new Response(
    openEventStream({
      db: runtime.db.db,
      bus: runtime.bus,
      workspaceId: workspace.id,
      filter: {},
      lastEventId,
      signal: request.signal,
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    },
  )
}
