import { StreamEvent as StreamEventSchema } from '@mailsink/contracts'
import { MailsinkError } from '../errors'
import type { Transport } from '../http'
import type { StreamEvent, StreamEventType } from '../types'
import { SseParser } from './sse'

export interface SubscribeOptions {
  /** Event types to receive (`workspace.deleted` always comes). */
  types?: StreamEventType[]
  /** Keep the message and log frames of one connection only. */
  connectionId?: string
  /** Resume after this event id (`evt_…`), as a reconnection does. */
  lastEventId?: string
  /** Delay before reconnecting, in ms; default: the server `retry:` (3 000). */
  retryMs?: number
  signal?: AbortSignal
  /** Called on every (re)connection. */
  onOpen?: () => void
  /** Lost connections, unreadable frames, handler failures and the final error. */
  onError?: (error: unknown) => void
}

export interface StreamFrame {
  /** `evt_…` id of the frame, `null` for derived frames (statuses, logs, deliveries...). */
  id: string | null
}

export type StreamHandler = (event: StreamEvent, frame: StreamFrame) => void | Promise<void>

export interface Subscription {
  /** Resolves once the first connection is open; rejects if it is refused. */
  readonly ready: Promise<void>
  /** Resolves when the subscription stops; rejects on a refusal (401, 403, 404...). */
  readonly done: Promise<void>
  /** Id of the last frame received with one, sent as `Last-Event-ID` on reconnection. */
  readonly lastEventId: string | undefined
  close(): void
}

const DEFAULT_RETRY_MS = 3_000
// Answers that reconnecting cannot fix: a bad key, another workspace, a bad filter.
const FATAL_STATUS = new Set([400, 401, 403, 404, 422])

/**
 * Subscribes to `GET /capture/stream` (SSE over `fetch`, so Node and browsers alike) and
 * reconnects with `Last-Event-ID` when the connection drops: frames with an id missed
 * meanwhile are replayed by the server. Stops on `close()`, on the abort signal, or after a
 * `workspace.deleted` frame.
 */
export function subscribe(
  t: Transport,
  handler: StreamHandler,
  options: SubscribeOptions = {},
): Subscription {
  const controller = new AbortController()
  const stop = () => controller.abort()
  options.signal?.addEventListener('abort', stop, { once: true })
  if (options.signal?.aborted) stop()
  let lastEventId = options.lastEventId
  let serverRetry: number | undefined
  let opened = false
  let markReady: () => void = () => {}
  let failReady: (error: unknown) => void = () => {}
  const ready = new Promise<void>((resolve, reject) => {
    markReady = resolve
    failReady = reject
  })
  ready.catch(() => {})

  const report = (error: unknown) => options.onError?.(error)

  async function connect(): Promise<'reconnect' | 'stop'> {
    const response = await t.send({
      method: 'GET',
      path: '/capture/stream',
      auth: 'workspace',
      query: { types: options.types, connectionId: options.connectionId },
      headers: {
        accept: 'text/event-stream',
        ...(lastEventId && { 'last-event-id': lastEventId }),
      },
      signal: controller.signal,
    })
    opened = true
    markReady()
    options.onOpen?.()
    if (!response.body) return 'reconnect'
    const parser = new SseParser((ms) => {
      serverRetry = ms
    })
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return 'reconnect'
      for (const frame of parser.feed(decoder.decode(value, { stream: true }))) {
        if (frame.hasId) lastEventId = frame.lastEventId
        const event = readEvent(frame.data, t.options.validate === true)
        if (!event) {
          report(
            new MailsinkError({
              code: 'invalid_response',
              message: 'Unreadable stream frame',
              details: frame.data,
            }),
          )
          continue
        }
        try {
          await handler(event, { id: frame.hasId ? frame.lastEventId : null })
        } catch (error) {
          report(error)
        }
        if (event.type === 'workspace.deleted') {
          await reader.cancel().catch(() => {})
          return 'stop'
        }
      }
    }
  }

  async function run(): Promise<void> {
    while (!controller.signal.aborted) {
      try {
        if ((await connect()) === 'stop') return
      } catch (error) {
        if (controller.signal.aborted) return
        const fatal = error instanceof MailsinkError && FATAL_STATUS.has(error.status ?? 0)
        report(error)
        if (fatal) {
          if (!opened) failReady(error)
          throw error
        }
      }
      if (controller.signal.aborted) return
      await sleep(options.retryMs ?? serverRetry ?? DEFAULT_RETRY_MS, controller.signal)
    }
  }

  const done = run().finally(() => {
    options.signal?.removeEventListener('abort', stop)
    controller.abort()
    markReady()
  })
  done.catch(() => {})
  return {
    ready,
    done,
    get lastEventId() {
      return lastEventId
    },
    close: stop,
  }
}

function readEvent(data: string, validate: boolean): StreamEvent | undefined {
  try {
    const value: unknown = JSON.parse(data)
    if (!validate) return value as StreamEvent
    const parsed = StreamEventSchema.safeParse(value)
    return parsed.success ? parsed.data : undefined
  } catch {
    return undefined
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms)
    signal.addEventListener('abort', done, { once: true })
    function done() {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
  })
}
