// Public entry point of @devitek/mailsink (docs/guides/sdk.md).
export type { ConnectionsApi } from './admin/connections'
export type { TemplatesApi } from './admin/templates'
export type { WorkspacesApi } from './admin/workspaces'
export type { LogsApi } from './capture/logs'
export type { Attachment, MessagesApi } from './capture/messages'
export type { ActivateOptions, OverrideScope, OverridesApi } from './capture/overrides'
export type { SuppressionsApi } from './capture/suppressions'
export { DEFAULT_WAIT_TIMEOUT_MS, type WaitForOptions } from './capture/wait'
export type { WebhooksApi } from './capture/webhooks'
export { createMailsink, type Mailsink } from './client'
export { isMailsinkError, MailsinkError, type MailsinkErrorCode } from './errors'
export { type ExtractCodeOptions, extractCode } from './helpers/code'
export { extractLinks, findLink, type LinkMatcher, type MessageContent } from './helpers/links'
export type { MailsinkOptions } from './http'
export type {
  StreamFrame,
  StreamHandler,
  SubscribeOptions,
  Subscription,
} from './stream/subscribe'
export type * from './types'
