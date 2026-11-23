import type { StreamEvent } from '@mailsink/contracts'

// EventSource with the recovery the inbox needs (#39). While the browser reconnects by
// itself it sends `Last-Event-ID`; once it gives up (an error status, the server gone for
// good) the stream is reopened here with `?lastEventId=` and a growing delay.

export type StreamState = 'connecting' | 'live' | 'reconnecting'

/** The parts of EventSource used here (a fake in tests). */
export interface EventSourceLike {
  readonly readyState: number
  onopen: ((event: Event) => void) | null
  onmessage: ((event: MessageEvent<string>) => void) | null
  onerror: ((event: Event) => void) | null
  close(): void
}

export interface StreamOptions {
  url: (lastEventId: string | null) => string
  onEvent: (event: StreamEvent) => void
  onState: (state: StreamState) => void
  /** Called when the stream is back after a gap: derived frames are never replayed. */
  onResync: () => void
  open?: (url: string) => EventSourceLike
  /** Delays of the manual reopenings, the last one repeated. */
  backoffMs?: readonly number[]
}

const CLOSED = 2
const DEFAULT_BACKOFF = [1_000, 2_000, 5_000, 10_000, 30_000]

export function connectStream(options: StreamOptions): () => void {
  const open = options.open ?? ((url: string) => new EventSource(url) as EventSourceLike)
  const backoff = options.backoffMs ?? DEFAULT_BACKOFF
  let lastEventId: string | null = null
  let source: EventSourceLike | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let failures = 0
  let interrupted = false
  let stopped = false

  const connect = () => {
    source = open(options.url(lastEventId))
    source.onopen = () => {
      failures = 0
      options.onState('live')
      if (interrupted) {
        interrupted = false
        options.onResync()
      }
    }
    source.onmessage = (message) => {
      if (message.lastEventId) lastEventId = message.lastEventId
      let event: StreamEvent
      try {
        event = JSON.parse(message.data) as StreamEvent
      } catch {
        return
      }
      options.onEvent(event)
    }
    source.onerror = () => {
      if (stopped) return
      interrupted = true
      options.onState('reconnecting')
      if (source?.readyState !== CLOSED) return
      const delay = backoff[Math.min(failures, backoff.length - 1)] ?? 30_000
      failures += 1
      timer = setTimeout(connect, delay)
    }
  }

  options.onState('connecting')
  connect()
  return () => {
    stopped = true
    clearTimeout(timer)
    source?.close()
  }
}
