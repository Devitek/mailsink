import { writeSync } from 'node:fs'
import { definePlugin } from 'nitro'
import { stopRuntime } from './boot'
import { startRuntimeFromPlugin, whenRestartSettled } from './restart'

/**
 * Last line of a stop, written synchronously to fd 1: in `vite dev` the runtime lives in a
 * worker thread whose console is flushed asynchronously by the main thread, and the thread
 * is terminated right after the close hook, so a console.info here was sometimes lost.
 */
function writeFinalLine(line: string): void {
  try {
    writeSync(1, `${line}\n`)
  } catch {
    console.info(line)
  }
}

/**
 * D3 (spike #9): Nitro plugins run when the Nitro app is created, i.e. at process start in
 * the production build, whereas the TanStack server entry (src/server.ts) is only imported
 * at the first request. This plugin makes the boot eager and ties the stop to Nitro's
 * `close` hook: fired after srvx drained HTTP in production, and the only shutdown signal
 * that reaches the dev worker thread. In `vite dev`, editing code this plugin imports
 * re-evaluates it, which restarts the runtime (restart.ts startRuntimeFromPlugin).
 */
export default definePlugin((nitroApp) => {
  const { restart, ready } = startRuntimeFromPlugin()
  if (restart === 'scheduled') {
    // `vite dev` only (#60): Vite re-evaluated this plugin because code it imports changed.
    // A broken edit must not kill the dev server: the next edit retries. The other
    // evaluations of the same edit join this restart ('coalesced') and log nothing.
    console.info('[mailsink] runtime code changed, restarting runtime')
    ready.catch((error: unknown) => {
      console.error('[mailsink] runtime restart failed, fix the code to retry', error)
    })
  } else if (!restart) {
    ready.catch((error: unknown) => {
      // Fail fast (#56): port taken, database unreachable, migration or config error. The
      // orchestrator restarts the process; serving 500s from a half-started one helps no one.
      console.error('[mailsink] runtime failed to start, exiting', error)
      process.exit(1)
    })
  }
  nitroApp.hooks.hook('close', async () => {
    console.info('[mailsink] nitro close hook, stopping runtime')
    // A dev restart still in flight would boot a runtime after this stop: let it finish.
    await whenRestartSettled()
    await stopRuntime()
    writeFinalLine('[mailsink] runtime stopped by nitro close hook')
  })
})
