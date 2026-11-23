export {
  type CreateDbOptions,
  createDb,
  type Database,
  type DbHandle,
  type Driver,
  type Executor,
  type Schema,
} from './client'
export { type IdPrefix, newId } from './ids'
export { MIGRATIONS_FOLDER, type MigrateOptions, migrate } from './migrate'
// Repositories are re-exported by name: a name clash between two of them fails the build
// instead of `export *` silently dropping both.
export {
  type ActiveApiKey,
  type ApiKey,
  activeKeyPrefixes,
  findActiveApiKeyByHash,
  insertApiKeys,
  type NewApiKey,
} from './repositories/api-keys'
export {
  getBlobData,
  putBlob,
  type StoredBlob,
} from './repositories/blobs'
export {
  type Connection,
  insertConnections,
  listConnections,
  type NewConnection,
} from './repositories/connections'
export {
  findWorkspaceMessagesByIds,
  listMessageStreamEvents,
  listWorkspaceEventsAfter,
  type StreamEventRow,
} from './repositories/events-stream'
export {
  findIdempotencyRecord,
  type IdempotencyRecord,
  insertIdempotencyRecord,
} from './repositories/idempotency'
export {
  type ClaimOptions,
  claimJobs,
  completeJob,
  countFailedJobs,
  enqueueJobs,
  FAILED_JOB_RUN_AT,
  failJob,
  type Job,
  type NewJob,
  type RetryOptions,
  releaseJobs,
  retryJob,
} from './repositories/jobs'
export {
  type ApiLog,
  type ApiLogDialect,
  type ApiLogFilters,
  findApiLog,
  insertApiLog,
  listApiLogs,
  type NewApiLog,
} from './repositories/logs-api'
export type { LogPage, LogTimeRange } from './repositories/logs-query'
export {
  findSmtpSession,
  insertSmtpSession,
  listSmtpSessions,
  type NewSmtpSession,
  type SmtpSession,
  type SmtpSessionFilters,
  type SmtpSessionOutcome,
} from './repositories/logs-smtp'
export {
  type MessagePurge,
  purgeMessages,
} from './repositories/messages-purge'
export {
  type AttachmentRow,
  type DeliveryStatusValue,
  findAttachmentContent,
  findRawMessage,
  findWorkspaceMessage,
  listAttachments,
  listMessageEvents,
  listRecipients,
  type MessageEventRow,
  type MessageListRow,
  type MessageRow,
  type MessageSearch,
  type RecipientRow,
  searchMessages,
} from './repositories/messages-read'
export {
  insertMessageEvents,
  listRecipientsForSimulation,
  lockMessage,
  type NewMessageEventRow,
  type SimulatedMessage,
  type SimulatedRecipient,
  setMessageSimulation,
  setMessageStatus,
  setRecipientsStatus,
} from './repositories/messages-status'
export {
  findSuppressedEmails,
  insertMessageGraph,
  type MessageGraph,
  type NewAttachment,
  type NewMessage,
  type NewMessageEvent,
  type NewMessageRecipient,
} from './repositories/messages-write'
export {
  closeExpiredOverrides,
  closeOverride,
  findActiveOverrides,
  findSettingsLayers,
  insertOverride,
  type NewOverride,
  type Override,
  type StoredSettingsLayers,
} from './repositories/overrides'
export {
  deleteExpiredIdempotencyKeys,
  deleteOrphanBlobs,
  enforceMaxMessages,
  purgeExpiredLogs,
  purgeExpiredMessages,
  purgeFailedJobs,
} from './repositories/retention'
export {
  addSuppressions,
  deleteSuppressions,
  type ListSuppressionsOptions,
  listSuppressions,
  type NewSuppression,
  type Suppression,
} from './repositories/suppressions'
export {
  deleteWebhookEndpoint,
  findConnectionKind,
  findWebhookEndpoint,
  hasEnabledWebhookEndpoints,
  insertWebhookEndpoint,
  listEndpointsInScope,
  listWebhookEndpoints,
  type NewWebhookEndpoint,
  updateWebhookEndpoint,
  type WebhookEndpoint,
  type WebhookEndpointUpdate,
} from './repositories/webhooks'
export {
  findWebhookMessage,
  findWebhookWorkspace,
  type WebhookMessageRow,
  type WebhookWorkspaceRow,
} from './repositories/webhooks-context'
export {
  findDeliveryWithEndpoint,
  findWebhookAttempt,
  findWebhookDelivery,
  insertWebhookAttempt,
  insertWebhookDeliveries,
  type ListDeliveriesOptions,
  listWebhookAttempts,
  listWebhookDeliveries,
  type NewWebhookAttempt,
  type NewWebhookDelivery,
  updateWebhookDelivery,
  type WebhookAttempt,
  type WebhookDelivery,
} from './repositories/webhooks-deliveries'
export {
  deleteExpiredWorkspaces,
  touchWorkspaceActivity,
} from './repositories/workspace-activity'
export {
  deleteWorkspace,
  findWorkspaceByRef,
  insertWorkspace,
  type ListWorkspacesOptions,
  listWorkspaces,
  type NewWorkspace,
  type Workspace,
} from './repositories/workspaces'
export * as schema from './schema'
export * from './schema'
export { type DatabaseTarget, DEFAULT_DATABASE_URL, parseDatabaseUrl } from './url'
