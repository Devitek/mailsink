// `GET /capture/stream` (03-contracts, « Stream »): Server-Sent Events of one workspace,
// workspace scope auth (D12), fed by the in-process bus (D6).
import { StreamQuery } from '@mailsink/contracts'
import { defineApi } from '../handler'
import { openEventStream } from './stream-sse'

export const streamEvents = defineApi({
  auth: 'workspace',
  query: StreamQuery,
  handler: ({ request, runtime, auth, query }) =>
    new Response(
      openEventStream({
        db: runtime.db.db,
        bus: runtime.bus,
        workspaceId: auth.workspace.id,
        filter: query,
        lastEventId: request.headers.get('last-event-id'),
        signal: request.signal,
      }),
      {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          // Reverse proxies (nginx) must not buffer the stream.
          'X-Accel-Buffering': 'no',
        },
      },
    ),
})
