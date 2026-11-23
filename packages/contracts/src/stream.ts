import { z } from 'zod'
import { MessageEventView, MessageSummary } from './capture'
import { ConnectionId, MessageId, WorkspaceId } from './ids'
import { ApiLogSummary, SmtpSessionSummary } from './logs'
import { OverrideState } from './override'
import { DeliveryStatus } from './status'

// `GET /capture/stream` (03-contracts, « Stream »). The `webhook.delivery` variant joins
// with its view contract (webhook deliveries #33).
export const StreamEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('message.created'), message: MessageSummary }),
  z.object({
    type: z.literal('message.status'),
    messageId: MessageId,
    status: DeliveryStatus,
    recipient: z.string().nullable(), // null: the aggregated message status
  }),
  z.object({ type: z.literal('message.event'), event: MessageEventView }),
  z.object({ type: z.literal('log.api'), log: ApiLogSummary }),
  z.object({ type: z.literal('log.smtp'), session: SmtpSessionSummary }),
  z.object({ type: z.literal('override.changed'), state: OverrideState }),
  z.object({ type: z.literal('messages.purged'), count: z.number().int().min(0) }),
  // Last frame of a stream: the workspace is gone (ephemeral GC).
  z.object({ type: z.literal('workspace.deleted'), workspaceId: WorkspaceId }),
])

export const StreamEventType = z.enum([
  'message.created',
  'message.status',
  'message.event',
  'log.api',
  'log.smtp',
  'override.changed',
  'messages.purged',
  'workspace.deleted',
])

/** `types`: comma-separated or repeated; `workspace.deleted` is always sent. */
export const StreamQuery = z.object({
  connectionId: ConnectionId.optional(),
  types: z
    .preprocess((v) => (typeof v === 'string' ? v.split(',') : v), z.array(StreamEventType))
    .optional(),
})

export type StreamEvent = z.output<typeof StreamEvent>
export type StreamEventType = z.output<typeof StreamEventType>
export type StreamQuery = z.output<typeof StreamQuery>
