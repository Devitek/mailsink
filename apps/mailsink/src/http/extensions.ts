import type { Runtime } from '../runtime/container'
import type { AuthFor, AuthMode } from './auth'

export interface RequestContext<M extends AuthMode = AuthMode> {
  request: Request
  requestId: string
  runtime: Runtime
  auth: AuthFor<M>
  /** `performance.now()` when defineApi received the request. */
  startedAt: number
}

/**
 * Hook into every defineApi() route without touching it. Planned users: rate limit (#24,
 * `afterAuth` throws `rate_limited`, `onResponse` adds the headers), workspace activity
 * (#20, `afterAuth`), request log (#35, `onResponse` writes `api_logs`).
 */
export interface ApiExtension {
  name: string
  /** After authentication, before input parsing. Throw a DomainError to reject the call. */
  afterAuth?: (ctx: RequestContext) => Promise<void> | void
  /**
   * Once the response is built, success or error (headers are still mutable). `auth` is
   * undefined when authentication failed. Errors here are logged, never sent.
   */
  onResponse?: (
    ctx: Omit<RequestContext, 'auth'> & { auth: AuthFor<AuthMode> | undefined },
    response: Response,
    error: unknown,
  ) => Promise<void> | void
}

/** Extensions applied to every route; features register theirs here. */
export const DEFAULT_EXTENSIONS: readonly ApiExtension[] = []
