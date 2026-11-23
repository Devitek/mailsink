import { createServerFn } from '@tanstack/react-start'
import { whenRuntimeReady } from '../runtime/slot'

// MAILSINK_PUBLIC_URL for the root loader (absolute Open Graph URLs). The Start compiler
// strips the handler, and the runtime slot it reads, from the client.

export const getPublicUrl = createServerFn({ method: 'GET' }).handler(
  async () => (await whenRuntimeReady()).config.publicUrl,
)
