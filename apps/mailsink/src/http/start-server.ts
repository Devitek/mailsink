// Request helpers of TanStack Start (getCookie, setCookie, getRequestHeader), read from the
// module namespace once it is complete.
//
// Under `vite dev`, editing the route tree re-evaluates `@tanstack/start-server-core` (it
// imports the router virtual modules, which import back the modules using it). The module
// runner then hands the importers a partial namespace, and a request served meanwhile fails
// with `getCookie is not a function` (#99), even through a dynamic import (the cycle makes the
// runner return the partial exports instead of waiting). The namespace object is live, so
// waiting a few milliseconds for the evaluation to finish is enough. In a build the module
// is complete from the start and the first check passes.

export type StartServer = typeof import('@tanstack/react-start/server')

const STEP_MS = 10
const TIMEOUT_MS = 5_000

/** Resolves `load()` once `isReady` holds on its (live) result; rejects after `timeoutMs`. */
export async function whenComplete<T>(
  load: () => Promise<T>,
  isReady: (value: T) => boolean,
  { stepMs = STEP_MS, timeoutMs = TIMEOUT_MS } = {},
): Promise<T> {
  const value = await load()
  const deadline = Date.now() + timeoutMs
  while (!isReady(value)) {
    if (Date.now() >= deadline) throw new Error('module namespace still incomplete')
    await new Promise((resolve) => setTimeout(resolve, stepMs))
  }
  return value
}

export function startServer(): Promise<StartServer> {
  return whenComplete(
    () => import('@tanstack/react-start/server'),
    (ns) =>
      typeof ns.getCookie === 'function' &&
      typeof ns.setCookie === 'function' &&
      typeof ns.getRequestHeader === 'function',
  )
}
