import type {
  WebhookEndpointInput,
  WebhookEndpointPatch,
  WebhookPreviewRequest,
  WebhookPreviewResponse,
} from '@mailsink/contracts'
import {
  createWebhookEndpoint,
  isDomainError,
  listWebhookDeliveryViews,
  listWebhookEndpointViews,
  patchWebhookEndpoint,
  previewWebhook,
  removeWebhookEndpoint,
  sendTestWebhook,
} from '@mailsink/core'
import { findWebhookEndpoint } from '@mailsink/db'
import type { Runtime } from '../runtime/container'
import { touchWorkspace } from './connections.server'
import type { EndpointRow, EndpointSaved, FieldIssue, TestSendResult } from './webhooks-types'

// Webhook endpoints of the settings screen (#43): the core services of `/capture/webhooks`
// with the UI session instead of a workspace key (D175), workspace by slug, activity touched.

/** Endpoints of the workspace (every scope), each with its latest delivery. */
export async function listEndpoints(runtime: Runtime, slug: string): Promise<EndpointRow[]> {
  const workspaceId = await touchWorkspace(runtime, slug)
  const db = runtime.db.db
  const { data } = await listWebhookEndpointViews(db, workspaceId, {})
  return Promise.all(
    data.map(async (endpoint) => {
      const page = await listWebhookDeliveryViews(db, workspaceId, {
        endpointId: endpoint.id,
        limit: 1,
      })
      const last = page.data[0]
      const lastDelivery = last
        ? { status: last.status, statusCode: last.lastStatusCode, createdAt: last.createdAt }
        : null
      return { ...endpoint, lastDelivery }
    }),
  )
}

/** Body validation refusals of core (reserved header, private URL…) as field issues. */
export function fieldIssues(error: unknown): FieldIssue[] | null {
  if (!isDomainError(error) || error.code !== 'validation_error') return null
  const details = error.details as { issues?: unknown } | undefined
  const issues = Array.isArray(details?.issues) ? details.issues : []
  const mapped = issues.map((issue: { path?: unknown[]; params?: { code?: string } }) => ({
    path: (issue.path ?? []).join('.'),
    code: issue.params?.code ?? 'validation_error',
    message: error.message,
  }))
  return mapped.length > 0
    ? mapped
    : [{ path: '', code: 'validation_error', message: error.message }]
}

async function saving(
  write: () => ReturnType<typeof createWebhookEndpoint>,
): Promise<EndpointSaved> {
  try {
    return { ok: true, endpoint: await write() }
  } catch (error) {
    const issues = fieldIssues(error)
    if (issues) return { ok: false, issues }
    throw error
  }
}

export async function createEndpoint(
  runtime: Runtime,
  slug: string,
  input: WebhookEndpointInput,
): Promise<EndpointSaved> {
  const workspaceId = await touchWorkspace(runtime, slug)
  return saving(() =>
    createWebhookEndpoint(runtime.db.db, workspaceId, input, {
      urlGuard: runtime.webhookUrlGuard,
    }),
  )
}

export async function updateEndpoint(
  runtime: Runtime,
  slug: string,
  id: string,
  patch: WebhookEndpointPatch,
): Promise<EndpointSaved> {
  const workspaceId = await touchWorkspace(runtime, slug)
  return saving(() =>
    patchWebhookEndpoint(runtime.db.db, workspaceId, id, patch, {
      urlGuard: runtime.webhookUrlGuard,
    }),
  )
}

export async function deleteEndpoint(runtime: Runtime, slug: string, id: string): Promise<void> {
  const workspaceId = await touchWorkspace(runtime, slug)
  await removeWebhookEndpoint(runtime.db.db, workspaceId, id)
}

/**
 * The stored signing secret, on demand (D202): the UI session already holds the admin
 * key's powers. Brevo endpoints have none (their credentials stay write-only).
 */
export async function revealSecret(
  runtime: Runtime,
  slug: string,
  id: string,
): Promise<{ secret: string | null }> {
  const workspaceId = await touchWorkspace(runtime, slug)
  const row = await findWebhookEndpoint(runtime.db.db, workspaceId, id)
  if (!row) return { secret: null }
  return { secret: row.payloadFormat === 'brevo' ? null : row.secret }
}

export async function previewEndpoint(
  runtime: Runtime,
  slug: string,
  input: WebhookPreviewRequest,
): Promise<WebhookPreviewResponse> {
  const workspaceId = await touchWorkspace(runtime, slug)
  return previewWebhook(runtime.db.db, workspaceId, input)
}

export async function testEndpoint(
  runtime: Runtime,
  slug: string,
  id: string,
  event: string | undefined,
): Promise<TestSendResult> {
  const workspaceId = await touchWorkspace(runtime, slug)
  const detail = await sendTestWebhook(runtime.db.db, workspaceId, id, event, {
    bus: runtime.bus,
    urlGuard: runtime.webhookUrlGuard,
  })
  const attempt = detail.attempts.at(-1)
  return {
    deliveryId: detail.id,
    status: detail.status,
    statusCode: attempt?.responseStatus ?? null,
    durationMs: attempt?.durationMs ?? null,
    error: attempt?.error ?? null,
    event: detail.dialectEvent,
  }
}
