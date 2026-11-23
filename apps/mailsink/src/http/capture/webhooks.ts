// Webhook endpoint API (03-contracts, « Webhooks », #32): workspace scope auth (D12, D41).
import {
  ListWebhookEndpointsQuery,
  WebhookEndpointId,
  WebhookEndpointInput,
  WebhookEndpointPatch,
  WebhookPreviewRequest,
  WebhookTestRequest,
} from '@mailsink/contracts'
import {
  createWebhookEndpoint,
  getWebhookEndpointView,
  listWebhookEndpointViews,
  patchWebhookEndpoint,
  previewWebhook,
  removeWebhookEndpoint,
  sendTestWebhook,
} from '@mailsink/core'
import { z } from 'zod'
import { defineApi } from '../handler'

const EndpointParams = z.object({ id: WebhookEndpointId })

/** GET /capture/webhooks[?connectionId=]: that scope and the Workspace scope. */
export const listWebhooksApi = defineApi({
  auth: 'workspace',
  query: ListWebhookEndpointsQuery,
  handler: ({ runtime, auth, query }) =>
    listWebhookEndpointViews(runtime.db.db, auth.workspace.id, query),
})

/** POST /capture/webhooks: 201 with the clear secret, shown once. */
export const createWebhookApi = defineApi({
  auth: 'workspace',
  body: WebhookEndpointInput,
  handler: async ({ runtime, auth, body }) =>
    Response.json(await createWebhookEndpoint(runtime.db.db, auth.workspace.id, body), {
      status: 201,
    }),
})

export const getWebhookApi = defineApi({
  auth: 'workspace',
  params: EndpointParams,
  handler: ({ runtime, auth, params }) =>
    getWebhookEndpointView(runtime.db.db, auth.workspace.id, params.id),
})

/** PATCH /capture/webhooks/:id: `secret` is set when one was issued (rotation). */
export const patchWebhookApi = defineApi({
  auth: 'workspace',
  params: EndpointParams,
  body: WebhookEndpointPatch,
  handler: ({ runtime, auth, params, body }) =>
    patchWebhookEndpoint(runtime.db.db, auth.workspace.id, params.id, body),
})

export const deleteWebhookApi = defineApi({
  auth: 'workspace',
  params: EndpointParams,
  handler: ({ runtime, auth, params }) =>
    removeWebhookEndpoint(runtime.db.db, auth.workspace.id, params.id),
})

/** POST /capture/webhooks/preview: body and headers of the real formatter, secret masked. */
export const previewWebhookApi = defineApi({
  auth: 'workspace',
  body: WebhookPreviewRequest,
  handler: ({ runtime, auth, body }) => previewWebhook(runtime.db.db, auth.workspace.id, body),
})

/** POST /capture/webhooks/:id/test: one signed sample event, logged as a delivery. */
export const testWebhookApi = defineApi({
  auth: 'workspace',
  params: EndpointParams,
  body: WebhookTestRequest.optional(),
  handler: ({ runtime, auth, params, body }) =>
    sendTestWebhook(runtime.db.db, auth.workspace.id, params.id, body?.event, {
      bus: runtime.bus,
    }),
})
