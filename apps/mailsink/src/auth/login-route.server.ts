import { whenRuntimeReady } from '../runtime/slot'
import { handleLogin } from './login-handler'
import { clientAddress, loginLimiter } from './session.server'

/** `POST /login` in the request context: runtime config, process limiter, client address. */
export async function postLogin(request: Request): Promise<Response> {
  const runtime = await whenRuntimeReady()
  return handleLogin(request, {
    config: runtime.config,
    limiter: loginLimiter(runtime),
    client: clientAddress(),
  })
}
