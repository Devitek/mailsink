import { describe, expect, it, vi } from 'vitest'
import { createEventBus, publishAll, type StreamFrame } from './bus'

const purged = (count: number): StreamFrame => ({
  id: null,
  connectionId: null,
  event: { type: 'messages.purged', count },
})

describe('event bus', () => {
  it('delivers a frame to the subscribers of its workspace only', () => {
    const bus = createEventBus()
    const a: StreamFrame[] = []
    const b: StreamFrame[] = []
    bus.subscribe('ws_a', (f) => a.push(f))
    bus.subscribe('ws_b', (f) => b.push(f))
    bus.publish('ws_a', purged(1))
    publishAll(bus, 'ws_b', [purged(2), purged(3)])
    expect(a.map((f) => f.event)).toEqual([{ type: 'messages.purged', count: 1 }])
    expect(b).toHaveLength(2)
  })

  it('stops delivering after unsubscribe and forgets empty channels', () => {
    const bus = createEventBus()
    const seen: StreamFrame[] = []
    const off = bus.subscribe('ws_a', (f) => seen.push(f))
    expect(bus.hasSubscribers('ws_a')).toBe(true)
    off()
    off()
    bus.publish('ws_a', purged(1))
    expect(seen).toEqual([])
    expect(bus.hasSubscribers('ws_a')).toBe(false)
  })

  it('isolates a failing listener', () => {
    const log = { error: vi.fn() }
    const bus = createEventBus(log)
    const seen: StreamFrame[] = []
    bus.subscribe('ws_a', () => {
      throw new Error('boom')
    })
    bus.subscribe('ws_a', (f) => seen.push(f))
    bus.publish('ws_a', purged(1))
    expect(seen).toHaveLength(1)
    expect(log.error).toHaveBeenCalledOnce()
  })

  it('lets a listener unsubscribe while the frame is being delivered', () => {
    const bus = createEventBus()
    const seen: string[] = []
    const off = bus.subscribe('ws_a', () => {
      seen.push('first')
      off()
    })
    bus.subscribe('ws_a', () => seen.push('second'))
    bus.publish('ws_a', purged(1))
    bus.publish('ws_a', purged(2))
    expect(seen).toEqual(['first', 'second', 'second'])
  })

  it('publishAll without a bus is a no-op', () => {
    expect(() => publishAll(undefined, 'ws_a', [purged(1)])).not.toThrow()
  })
})
