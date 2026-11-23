import {
  ApiLogId,
  ListApiLogsQuery,
  ListSmtpSessionsQuery,
  ListWebhookDeliveriesQuery,
  ReplayRequest,
  SmtpSessionId,
  WebhookDeliveryId,
} from '@mailsink/contracts'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  readApiLog,
  readApiLogs,
  readDeliveries,
  readDelivery,
  readLogSources,
  readSmtpSession,
  readSmtpSessions,
  replayDelivery,
} from './logs.server'
import { signedIn } from './messages-fns'

// Logs explorer server functions (#41): the session is checked by each one (`signedIn`),
// the queries are the Capture contracts of `/capture/logs/**` and the delivery log.

const Slug = z.string().min(1).max(200)

export const logSourcesFn = createServerFn({ method: 'GET' })
  .middleware([signedIn])
  .validator(z.object({ slug: Slug }))
  .handler(({ context, data }) => readLogSources(context.runtime, data.slug))

export const listApiLogsFn = createServerFn({ method: 'GET' })
  .middleware([signedIn])
  .validator(z.object({ slug: Slug, query: ListApiLogsQuery }))
  .handler(({ context, data }) => readApiLogs(context.runtime, data.slug, data.query))

export const getApiLogFn = createServerFn({ method: 'GET' })
  .middleware([signedIn])
  .validator(z.object({ slug: Slug, id: ApiLogId }))
  .handler(({ context, data }) => readApiLog(context.runtime, data.slug, data.id))

export const listSmtpSessionsFn = createServerFn({ method: 'GET' })
  .middleware([signedIn])
  .validator(z.object({ slug: Slug, query: ListSmtpSessionsQuery }))
  .handler(({ context, data }) => readSmtpSessions(context.runtime, data.slug, data.query))

export const getSmtpSessionFn = createServerFn({ method: 'GET' })
  .middleware([signedIn])
  .validator(z.object({ slug: Slug, id: SmtpSessionId }))
  .handler(({ context, data }) => readSmtpSession(context.runtime, data.slug, data.id))

export const listDeliveriesFn = createServerFn({ method: 'GET' })
  .middleware([signedIn])
  .validator(z.object({ slug: Slug, query: ListWebhookDeliveriesQuery }))
  .handler(({ context, data }) => readDeliveries(context.runtime, data.slug, data.query))

export const getDeliveryFn = createServerFn({ method: 'GET' })
  .middleware([signedIn])
  .validator(z.object({ slug: Slug, id: WebhookDeliveryId }))
  .handler(({ context, data }) => readDelivery(context.runtime, data.slug, data.id))

export const replayDeliveryFn = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(z.object({ slug: Slug, id: WebhookDeliveryId, request: ReplayRequest }))
  .handler(({ context, data }) => replayDelivery(context.runtime, data.slug, data.id, data.request))
