import { EventId } from '@mailsink/contracts'
import {
  type EventBus,
  frameMatches,
  replayFrames,
  type StreamFilter,
  type StreamFrame,
} from '@mailsink/core'
import type { Database } from '@mailsink/db'

/** Heartbeat comment period (03-contracts, « Stream »). */
export const HEARTBEAT_MS = 15_000
/** Frames queued for a client that does not read; past it the stream is closed. */
export const MAX_QUEUED_FRAMES = 1_000
/** Reconnection delay suggested to EventSource. */
const RETRY_MS = 3_000

export interface EventStreamOptions {
  db: Database
  bus: EventBus
  workspaceId: string
  filter: StreamFilter
  /** `Last-Event-ID` header; anything that is not an event id is ignored. */
  lastEventId: string | null
  signal?: AbortSignal
  heartbeatMs?: number
}

/**
 * One frame: `id:` when a stored event backs it, no `event:` field (every frame reaches
 * `onmessage`, the JSON `type` tells them apart), the StreamEvent as `data:`.
 */
export function encodeFrame(frame: StreamFrame): string {
  const id = frame.id ? `id: ${frame.id}\n` : ''
  return `${id}data: ${JSON.stringify(frame.event)}\n\n`
}

/**
 * `text/event-stream` body. The bus subscription is taken first and buffered while the
 * `Last-Event-ID` replay is read, then flushed without the frames the replay already sent:
 * nothing is lost or doubled across a reconnection. `workspace.deleted` is the last frame.
 */
export function openEventStream(options: EventStreamOptions): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let open = true
  let cleanup = () => {}
  return new ReadableStream<Uint8Array>({
    start(controller) {
      let buffer: StreamFrame[] | undefined = []
      const sent = new Set<string>()
      const close = () => {
        if (!open) return
        open = false
        cleanup()
        controller.close()
      }
      const write = (chunk: string) => {
        if (!open) return
        controller.enqueue(encoder.encode(chunk))
        if ((controller.desiredSize ?? 0) <= -MAX_QUEUED_FRAMES) close()
      }
      const deliver = (frame: StreamFrame) => {
        if (frame.id && sent.has(frame.id)) return
        if (!frameMatches(frame, options.filter)) return
        write(encodeFrame(frame))
        if (frame.event.type === 'workspace.deleted') close()
      }
      const off = options.bus.subscribe(options.workspaceId, (frame) => {
        if (buffer) buffer.push(frame)
        else deliver(frame)
      })
      const heartbeat = setInterval(() => write(': ping\n\n'), options.heartbeatMs ?? HEARTBEAT_MS)
      const onAbort = () => close()
      options.signal?.addEventListener('abort', onAbort)
      cleanup = () => {
        off()
        clearInterval(heartbeat)
        options.signal?.removeEventListener('abort', onAbort)
      }
      write(`retry: ${RETRY_MS}\n: connected\n\n`)
      void replay(options).then(
        (frames) => {
          for (const frame of frames) {
            deliver(frame)
            if (frame.id) sent.add(frame.id)
          }
          const pending = buffer ?? []
          buffer = undefined
          for (const frame of pending) deliver(frame)
          sent.clear()
        },
        (error: unknown) => {
          console.error('[mailsink] stream replay failed', error)
          close()
        },
      )
    },
    cancel() {
      open = false
      cleanup()
    },
  })
}

function replay(options: EventStreamOptions): Promise<StreamFrame[]> {
  const last = options.lastEventId?.trim()
  if (!last || !EventId.safeParse(last).success) return Promise.resolve([])
  return replayFrames(options.db, options.workspaceId, last)
}
