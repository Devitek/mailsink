import { type ConnectionsApi, connectionsApi } from './admin/connections'
import { type TemplatesApi, templatesApi } from './admin/templates'
import { type WorkspacesApi, workspacesApi } from './admin/workspaces'
import { apiLogsApi, type LogsApi, logsApi } from './capture/logs'
import { type MessagesApi, messagesApi } from './capture/messages'
import { type OverridesApi, overridesApi } from './capture/overrides'
import { type SuppressionsApi, suppressionsApi } from './capture/suppressions'
import { type WebhooksApi, webhooksApi } from './capture/webhooks'
import { createServerClock, type ServerClock } from './clock'
import { createTransport, type MailsinkOptions } from './http'
import {
  type StreamHandler,
  type SubscribeOptions,
  type Subscription,
  subscribe,
} from './stream/subscribe'

/**
 * The client returned by `createMailsink`. Declared as an interface so the published
 * declarations reference the API types by name instead of inlining every response shape.
 */
export interface Mailsink {
  readonly options: Readonly<MailsinkOptions>
  admin: {
    workspaces: WorkspacesApi
    connections: ConnectionsApi
    templates: TemplatesApi
    /** API calls without a workspace (`/admin/logs/api`). */
    logs: LogsApi['api']
  }
  messages: MessagesApi
  overrides: OverridesApi
  suppressions: SuppressionsApi
  webhooks: WebhooksApi
  logs: LogsApi
  stream: {
    /** Live `StreamEvent`s of the workspace, reconnecting with `Last-Event-ID`. */
    subscribe(handler: StreamHandler, options?: SubscribeOptions): Subscription
  }
  /**
   * A client with some options changed, e.g. scoped to the workspace just created:
   * `mailsink.with({ key: created.workspaceKey })`.
   */
  with(patch: Partial<MailsinkOptions>): Mailsink
  /**
   * Current time of the server, estimated from the `Date` header of the answers received so
   * far (one second precision, only the proven skew is applied); the client clock before
   * the first answer. Shared with the clients made by `with` on the same URL.
   */
  now(): Date
}

/**
 * A Mailsink client. Admin calls need `adminKey`; workspace calls (messages, overrides,
 * suppressions, webhooks, logs, stream) need a workspace or connection `key`, or the
 * `adminKey` with `workspace`.
 *
 * ```ts
 * const mailsink = createMailsink({ url: 'http://localhost:3000', key: process.env.MAILSINK_KEY })
 * const email = await mailsink.messages.waitFor({ to: 'jane@example.com' })
 * ```
 */
export function createMailsink(options: MailsinkOptions): Mailsink {
  return build(options, createServerClock())
}

function build(options: MailsinkOptions, clock: ServerClock): Mailsink {
  const t = createTransport(options, clock)
  return {
    options: t.options,
    admin: {
      workspaces: workspacesApi(t),
      connections: connectionsApi(t),
      templates: templatesApi(t),
      /** API calls without a workspace (`/admin/logs/api`). */
      logs: apiLogsApi(t, 'admin'),
    },
    messages: messagesApi(t),
    overrides: overridesApi(t),
    suppressions: suppressionsApi(t),
    webhooks: webhooksApi(t),
    logs: logsApi(t),
    stream: {
      /** Live `StreamEvent`s of the workspace, reconnecting with `Last-Event-ID`. */
      subscribe: (handler: StreamHandler, subscribeOptions?: SubscribeOptions) =>
        subscribe(t, handler, subscribeOptions),
    },
    /**
     * A client with some options changed, e.g. scoped to the workspace just created:
     * `mailsink.with({ key: created.workspaceKey })`.
     */
    with: (patch: Partial<MailsinkOptions>) => {
      const next = { ...options, ...patch }
      const sameServer = String(next.url) === String(options.url)
      return build(next, sameServer ? clock : createServerClock())
    },
    now: () => clock.now(),
  }
}
