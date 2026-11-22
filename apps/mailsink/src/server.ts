import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import { whenRuntimeReady } from './runtime/slot'

// D3: the runtime (SMTP listener, workers) is booted by src/runtime/nitro-plugin.ts at
// process start, because Nitro imports this entry lazily (first request) in the build.
// Requests wait for it so they never run before the runtime (and later migrations) is ready.
export default createServerEntry({
  async fetch(request, opts) {
    await whenRuntimeReady()
    return handler.fetch(request, opts)
  },
})
