import { secretsEqual } from '@mailsink/core'
import { z } from 'zod'
import type { RuntimeConfig } from '../runtime/config'
import type { LoginLimiter } from './login-limiter'
import { newSessionCookie, sessionSecret, uiAuth } from './session'

// `POST /login` (03-contracts « Web UI auth »): exchanges the admin key for the session
// cookie. Not a defineApi() route: it answers the sign-in screen only, never touches a
// workspace, and its limiter is per client rather than per connection.

export interface LoginDeps {
  config: RuntimeConfig
  limiter: LoginLimiter
  /** Address of the caller, the limiter key. */
  client: string
  now?: number
}

const LoginBody = z.object({ key: z.string().min(1).max(1024) })
const MAX_BODY_BYTES = 4096

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } })

const error = (status: number, code: string, message: string, headers?: Record<string, string>) =>
  json(status, { error: { code, message } }, headers)

function tooMany(retryAfter: number) {
  return error(429, 'rate_limited', 'Too many sign-in attempts, try again later', {
    'Retry-After': String(retryAfter),
  })
}

async function readKey(request: Request): Promise<string | undefined> {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return
  const text = await request.text().catch(() => '')
  if (text.length > MAX_BODY_BYTES) return
  try {
    const parsed = LoginBody.safeParse(JSON.parse(text))
    return parsed.success ? parsed.data.key : undefined
  } catch {
    return
  }
}

export async function handleLogin(request: Request, deps: LoginDeps): Promise<Response> {
  const { config, limiter, client } = deps
  if (uiAuth(config).auth === 'none') {
    return error(404, 'not_found', 'Sign-in is disabled (MAILSINK_UI_AUTH=none)')
  }
  // A paused client is refused before its key is even read (B2-3).
  const waiting = limiter.retryAfter(client)
  if (waiting > 0) return tooMany(waiting)

  const key = await readKey(request)
  if (key === undefined) {
    return error(422, 'validation_error', 'Expected a JSON body { "key": string }')
  }
  const secret = sessionSecret(config)
  if (config.adminKey && secret && secretsEqual(key, config.adminKey)) {
    limiter.succeed(client)
    return new Response(null, {
      status: 204,
      headers: {
        'Set-Cookie': newSessionCookie(config, secret, deps.now),
        'Cache-Control': 'no-store',
      },
    })
  }
  limiter.fail(client)
  // The failure that reaches the threshold already answers 429, so L1e follows at once.
  const paused = limiter.retryAfter(client)
  if (paused > 0) return tooMany(paused)
  // Never how many attempts remain (B2-2).
  return error(401, 'unauthorized', 'Invalid admin key')
}
