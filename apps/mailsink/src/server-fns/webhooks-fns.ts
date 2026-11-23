import {
  Slug,
  WebhookEndpointId,
  WebhookEndpointInput,
  WebhookEndpointPatch,
  WebhookPreviewRequest,
} from '@mailsink/contracts'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  createEndpoint,
  deleteEndpoint,
  listEndpoints,
  previewEndpoint,
  revealSecret,
  testEndpoint,
  updateEndpoint,
} from './webhooks.server'
import { signedIn } from './workspaces-fns'

// Webhook endpoint server functions of the settings screen (#43), session-checked.

const Target = z.object({ slug: Slug, id: WebhookEndpointId })

export const listEndpointsFn = createServerFn({ method: 'GET' })
  .middleware([signedIn])
  .validator(z.object({ slug: Slug }))
  .handler(({ context, data }) => listEndpoints(context.runtime, data.slug))

export const createEndpointFn = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(z.object({ slug: Slug, endpoint: WebhookEndpointInput }))
  .handler(({ context, data }) => createEndpoint(context.runtime, data.slug, data.endpoint))

export const updateEndpointFn = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(Target.extend({ patch: WebhookEndpointPatch }))
  .handler(({ context, data }) => updateEndpoint(context.runtime, data.slug, data.id, data.patch))

export const deleteEndpointFn = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(Target)
  .handler(({ context, data }) => deleteEndpoint(context.runtime, data.slug, data.id))

export const revealSecretFn = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(Target)
  .handler(({ context, data }) => revealSecret(context.runtime, data.slug, data.id))

export const previewEndpointFn = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(z.object({ slug: Slug, preview: WebhookPreviewRequest }))
  .handler(({ context, data }) => previewEndpoint(context.runtime, data.slug, data.preview))

export const testEndpointFn = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(Target.extend({ event: z.string().min(1).max(100).optional() }))
  .handler(({ context, data }) => testEndpoint(context.runtime, data.slug, data.id, data.event))
