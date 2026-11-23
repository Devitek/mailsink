import type { StreamEvent } from '@mailsink/contracts'

/**
 * One published event. `id` is the `message_events` row it comes from (the SSE `id:`,
 * replayable through `Last-Event-ID`), null for a derived notification (aggregated status,
 * purge, override, workspace deletion) that no row backs. `connectionId` feeds the stream
 * filter without being sent.
 */
export interface StreamFrame {
  id: string | null
  connectionId: string | null
  event: StreamEvent
}

export type FrameListener = (frame: StreamFrame) => void

/**
 * In-process event bus (D6), one channel per workspace: SSE streams, `wait=true` and later
 * MCP `wait_for_email` subscribe; ingestion, the simulation handler and the GC publish.
 * Single instance by design (D3). Publishing is synchronous and never throws: a failing
 * listener is logged and the others still run.
 */
export interface EventBus {
  publish(workspaceId: string, frame: StreamFrame): void
  /** Returns the unsubscribe function (idempotent). */
  subscribe(workspaceId: string, listener: FrameListener): () => void
  /** Lets publishers skip building frames nobody listens to. */
  hasSubscribers(workspaceId: string): boolean
}

export function createEventBus(log: Pick<Console, 'error'> = console): EventBus {
  const channels = new Map<string, Set<FrameListener>>()
  return {
    publish(workspaceId, frame) {
      const listeners = channels.get(workspaceId)
      if (!listeners) return
      for (const listener of [...listeners]) {
        try {
          listener(frame)
        } catch (error) {
          log.error(`[mailsink] event bus listener failed on ${frame.event.type}`, error)
        }
      }
    },
    subscribe(workspaceId, listener) {
      let listeners = channels.get(workspaceId)
      if (!listeners) {
        listeners = new Set()
        channels.set(workspaceId, listeners)
      }
      listeners.add(listener)
      return () => {
        const current = channels.get(workspaceId)
        if (!current?.delete(listener)) return
        if (current.size === 0) channels.delete(workspaceId)
      }
    },
    hasSubscribers: (workspaceId) => (channels.get(workspaceId)?.size ?? 0) > 0,
  }
}

/** Publishes every frame in order; a missing bus (tests, CLI) publishes nothing. */
export function publishAll(
  bus: EventBus | undefined,
  workspaceId: string,
  frames: readonly StreamFrame[],
): void {
  if (!bus) return
  for (const frame of frames) bus.publish(workspaceId, frame)
}
