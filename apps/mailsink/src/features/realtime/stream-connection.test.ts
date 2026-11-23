import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { connectStream, type EventSourceLike, type StreamState } from './stream-connection'

class FakeSource implements EventSourceLike {
  readyState = 0
  onopen: EventSourceLike['onopen'] = null
  onmessage: EventSourceLike['onmessage'] = null
  onerror: EventSourceLike['onerror'] = null
  closed = false
  constructor(readonly url: string) {}
  close() {
    this.closed = true
    this.readyState = 2
  }
  emit(data: unknown, lastEventId = '') {
    this.onmessage?.({ data: JSON.stringify(data), lastEventId } as MessageEvent<string>)
  }
}

describe('stream connection', () => {
  let sources: FakeSource[]
  let states: StreamState[]
  let events: unknown[]
  let resyncs: number
  let stop: () => void

  beforeEach(() => {
    vi.useFakeTimers()
    sources = []
    states = []
    events = []
    resyncs = 0
    stop = connectStream({
      url: (id) => `/stream${id ? `?lastEventId=${id}` : ''}`,
      onEvent: (e) => events.push(e),
      onState: (s) => states.push(s),
      onResync: () => {
        resyncs += 1
      },
      open: (url) => {
        const source = new FakeSource(url)
        sources.push(source)
        return source
      },
      backoffMs: [100, 500],
    })
  })
  afterEach(() => {
    stop()
    vi.useRealTimers()
  })

  it('passes the frames on and ignores malformed ones', () => {
    const [source] = sources as [FakeSource]
    source.onopen?.(new Event('open'))
    source.emit({ type: 'messages.purged', count: 2 }, 'evt_1')
    source.onmessage?.({ data: 'not json', lastEventId: '' } as MessageEvent<string>)
    expect(events).toEqual([{ type: 'messages.purged', count: 2 }])
    expect(states).toEqual(['connecting', 'live'])
    expect(resyncs).toBe(0)
  })

  it('lets the browser reconnect, then asks for a resync', () => {
    const [source] = sources as [FakeSource]
    source.onopen?.(new Event('open'))
    source.onerror?.(new Event('error'))
    expect(states.at(-1)).toBe('reconnecting')
    vi.advanceTimersByTime(1_000)
    expect(sources).toHaveLength(1)
    source.onopen?.(new Event('open'))
    expect(states.at(-1)).toBe('live')
    expect(resyncs).toBe(1)
  })

  it('reopens a closed stream from the last event id, with a growing delay', () => {
    const [first] = sources as [FakeSource]
    first.onopen?.(new Event('open'))
    first.emit({ type: 'log.api' }, 'evt_9')
    first.readyState = 2
    first.onerror?.(new Event('error'))
    vi.advanceTimersByTime(99)
    expect(sources).toHaveLength(1)
    vi.advanceTimersByTime(1)
    const second = sources[1] as FakeSource
    expect(second.url).toBe('/stream?lastEventId=evt_9')
    second.readyState = 2
    second.onerror?.(new Event('error'))
    vi.advanceTimersByTime(499)
    expect(sources).toHaveLength(2)
    vi.advanceTimersByTime(1)
    const third = sources[2] as FakeSource
    third.onopen?.(new Event('open'))
    expect(resyncs).toBe(1)
  })

  it('stops for good when closed', () => {
    const [source] = sources as [FakeSource]
    stop()
    expect(source.closed).toBe(true)
    source.onerror?.(new Event('error'))
    vi.advanceTimersByTime(10_000)
    expect(sources).toHaveLength(1)
  })
})
