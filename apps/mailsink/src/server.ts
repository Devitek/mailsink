import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { withRuntime } from './runtime/slot'

// D3: the runtime (SMTP listener, workers) is booted by src/runtime/nitro-plugin.ts at
// process start, because Nitro imports this entry lazily (first request) in the build.
// Requests wait for it so they never run before the database is migrated and SMTP is up,
// and a dev restart waits for the requests in flight before stopping their runtime (#86).
export default createServerEntry({
  fetch: (request, opts) => withRuntime(async () => handler.fetch(request, opts)),
})
