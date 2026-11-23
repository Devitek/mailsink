import { connectionsApi } from './admin/connections'
import { templatesApi } from './admin/templates'
import { workspacesApi } from './admin/workspaces'
import { apiLogsApi, logsApi } from './capture/logs'
import { messagesApi } from './capture/messages'
import { overridesApi } from './capture/overrides'
import { suppressionsApi } from './capture/suppressions'
import { webhooksApi } from './capture/webhooks'
import { createTransport, type MailsinkOptions } from './http'
import { type StreamHandler, type SubscribeOptions, subscribe } from './stream/subscribe'

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
export function createMailsink(options: MailsinkOptions) {
  const t = createTransport(options)
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
    with: (patch: Partial<MailsinkOptions>) => createMailsink({ ...options, ...patch }),
  }
}

export type Mailsink = ReturnType<typeof createMailsink>
