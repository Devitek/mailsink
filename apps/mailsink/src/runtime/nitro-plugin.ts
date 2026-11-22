import { definePlugin } from 'nitro'
import { bootRuntime, stopRuntime } from './boot'

/**
 * D3 (spike #9): Nitro plugins run when the Nitro app is created, i.e. at process start in
 * the production build, whereas the TanStack server entry (src/server.ts) is only imported
 * at the first request. This plugin makes the boot eager and ties the stop to Nitro's
 * `close` hook, the only shutdown signal that reaches the dev worker thread.
 */
export default definePlugin((nitroApp) => {
  bootRuntime().catch((error: unknown) => {
    console.error('[mailsink] runtime failed to start', error)
    process.exitCode = 1
  })
  nitroApp.hooks.hook('close', async () => {
    console.info('[mailsink] nitro close hook, stopping runtime')
    await stopRuntime()
    console.info('[mailsink] runtime stopped by nitro close hook')
  })
})
