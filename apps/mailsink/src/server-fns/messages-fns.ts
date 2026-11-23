import { ConnectionId, DeliveryStatus, MessageId } from '@mailsink/contracts'
import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSession } from '../auth/session.server'
import {
  purgeInbox,
  readFacets,
  readInboxPage,
  readMessage,
  readPreviews,
  readRawSource,
} from './messages.server'

// Inbox server functions of the UI (#39, #40). Each one checks the session itself: route
// guards redirect first, this is the backstop for a direct call.

export const signedIn = createMiddleware({ type: 'function' }).server(async ({ next }) =>
  next({ context: { runtime: await requireSession() } }),
)

const Slug = z.string().min(1).max(200)
const Text = z.string().max(500).optional()

export const listInboxFn = createServerFn({ method: 'GET' })
  .middleware([signedIn])
  .validator(
    z.object({
      slug: Slug,
      filters: z.object({
        q: Text,
        status: DeliveryStatus.optional(),
        connectionId: ConnectionId.optional(),
        tag: Text,
      }),
      cursor: z.string().max(500).optional(),
    }),
  )
  .handler(({ context, data }) =>
    readInboxPage(context.runtime, data.slug, data.filters, data.cursor),
  )

export const inboxFacetsFn = createServerFn({ method: 'GET' })
  .middleware([signedIn])
  .validator(z.object({ slug: Slug }))
  .handler(({ context, data }) => readFacets(context.runtime, data.slug))

export const messagePreviewsFn = createServerFn({ method: 'GET' })
  .middleware([signedIn])
  .validator(z.object({ slug: Slug, ids: z.array(MessageId).max(200) }))
  .handler(({ context, data }) => readPreviews(context.runtime, data.slug, data.ids))

export const getMessageFn = createServerFn({ method: 'GET' })
  .middleware([signedIn])
  .validator(z.object({ slug: Slug, id: MessageId }))
  .handler(({ context, data }) => readMessage(context.runtime, data.slug, data.id))

export const getRawSourceFn = createServerFn({ method: 'GET' })
  .middleware([signedIn])
  .validator(z.object({ slug: Slug, id: MessageId }))
  .handler(({ context, data }) => readRawSource(context.runtime, data.slug, data.id))

export const purgeInboxFn = createServerFn({ method: 'POST' })
  .middleware([signedIn])
  .validator(z.object({ slug: Slug }))
  .handler(({ context, data }) => purgeInbox(context.runtime, data.slug))
