import {
  defaultPayloadFormat,
  type ListWebhookEndpointsQuery,
  type WebhookEndpointInput,
  type WebhookEndpointPatch,
  type WebhookEndpointView,
  type WebhookEndpointWithSecret,
} from '@mailsink/contracts'
import {
  deleteWebhookEndpoint,
  type Executor,
  findConnectionKind,
  findWebhookEndpoint,
  insertWebhookEndpoint,
  listWebhookEndpoints,
  newId,
  updateWebhookEndpoint,
  type WebhookEndpoint,
  type WebhookEndpointUpdate,
} from '@mailsink/db'
import { DomainError } from '../errors'
import { brevoSecret, checkBrevoAuth, checkCustomHeaders, normalizeEvents } from './endpoint-input'
import { generateWebhookSecret } from './secret'
import { toEndpointView } from './views'

// Endpoint CRUD (`/capture/webhooks`, #32). Every function is scoped to the caller's
// workspace: another workspace's endpoint is a 404, like a missing one.

const endpointNotFound = () => new DomainError('not_found', 'Webhook endpoint not found')

async function scopeOf(db: Executor, workspaceId: string, connectionId: string | null) {
  if (connectionId === null) return null
  const connection = await findConnectionKind(db, workspaceId, connectionId)
  if (!connection) throw new DomainError('not_found', 'Connection not found')
  return connection
}

async function findOwn(db: Executor, workspaceId: string, id: string): Promise<WebhookEndpoint> {
  const row = await findWebhookEndpoint(db, workspaceId, id)
  if (!row) throw endpointNotFound()
  return row
}

export async function createWebhookEndpoint(
  db: Executor,
  workspaceId: string,
  input: WebhookEndpointInput,
): Promise<WebhookEndpointWithSecret> {
  const scope = await scopeOf(db, workspaceId, input.connectionId)
  const payloadFormat = input.payloadFormat ?? defaultPayloadFormat(scope)
  const events = normalizeEvents(payloadFormat, input.events)
  checkBrevoAuth(payloadFormat, input.brevoAuth)
  checkCustomHeaders(input.customHeaders ?? [])
  const auth =
    payloadFormat === 'brevo'
      ? brevoSecret(input.brevoAuth)
      : { brevoAuth: 'none' as const, secret: generateWebhookSecret() }
  const row = await insertWebhookEndpoint(db, {
    id: newId('whe'),
    workspaceId,
    connectionId: input.connectionId,
    url: input.url,
    payloadFormat,
    events,
    ...auth,
    customHeaders: input.customHeaders ?? [],
    description: input.description ?? null,
    enabled: input.enabled ?? true,
  })
  return { ...toEndpointView(row), secret: payloadFormat === 'brevo' ? null : auth.secret }
}

export async function listWebhookEndpointViews(
  db: Executor,
  workspaceId: string,
  query: ListWebhookEndpointsQuery,
): Promise<{ data: WebhookEndpointView[] }> {
  const rows = await listWebhookEndpoints(db, workspaceId, { connectionId: query.connectionId })
  return { data: rows.map(toEndpointView) }
}

export async function getWebhookEndpointView(
  db: Executor,
  workspaceId: string,
  id: string,
): Promise<WebhookEndpointView> {
  return toEndpointView(await findOwn(db, workspaceId, id))
}

/**
 * PATCH: a format change keeps the canonical subscription (unrepresentable events are
 * reported in `unsupportedEvents`, D22). Leaving brevo or `rotateSecret` issues a new
 * `whsec_` secret, answered once; entering brevo drops the signing secret.
 */
export async function patchWebhookEndpoint(
  db: Executor,
  workspaceId: string,
  id: string,
  patch: WebhookEndpointPatch,
): Promise<WebhookEndpointWithSecret> {
  const row = await findOwn(db, workspaceId, id)
  if (patch.connectionId !== undefined) await scopeOf(db, workspaceId, patch.connectionId)
  const format = patch.payloadFormat ?? row.payloadFormat
  checkBrevoAuth(format, patch.brevoAuth)
  if (patch.customHeaders) checkCustomHeaders(patch.customHeaders)
  if (patch.rotateSecret && format === 'brevo') {
    throw new DomainError('validation_error', 'Brevo endpoints have no signing secret')
  }
  const set: WebhookEndpointUpdate = {
    connectionId: patch.connectionId,
    url: patch.url,
    payloadFormat: patch.payloadFormat,
    events: patch.events ? normalizeEvents(format, patch.events) : undefined,
    description: patch.description,
    customHeaders: patch.customHeaders,
    enabled: patch.enabled,
  }
  let secret: string | null = null
  if (format === 'brevo') {
    if (patch.brevoAuth) Object.assign(set, brevoSecret(patch.brevoAuth))
    else if (row.payloadFormat !== 'brevo') Object.assign(set, brevoSecret(undefined))
  } else if (row.payloadFormat === 'brevo' || patch.rotateSecret) {
    secret = generateWebhookSecret()
    Object.assign(set, { secret, brevoAuth: 'none' })
  }
  const updated = await updateWebhookEndpoint(db, workspaceId, id, set)
  if (!updated) throw endpointNotFound()
  return { ...toEndpointView(updated), secret }
}

export async function removeWebhookEndpoint(
  db: Executor,
  workspaceId: string,
  id: string,
): Promise<{ id: string }> {
  if (!(await deleteWebhookEndpoint(db, workspaceId, id))) throw endpointNotFound()
  return { id }
}
