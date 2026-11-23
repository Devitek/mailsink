import { describe, expect, it } from 'vitest'
import { SseParser } from '../src/stream/sse'

describe('SseParser', () => {
  it('parses frames split across chunks, with ids, comments and retry', () => {
    const retries: number[] = []
    const parser = new SseParser((ms) => retries.push(ms))
    expect(parser.feed('retry: 3000\n: connected\n\nid: evt_1\nda')).toEqual([])
    expect(parser.feed('ta: {"a":1}\r')).toEqual([])
    expect(parser.feed('\n\r\n')).toEqual([{ data: '{"a":1}', lastEventId: 'evt_1', hasId: true }])
    expect(parser.feed('data: line1\ndata:line2\n\n')).toEqual([
      { data: 'line1\nline2', lastEventId: 'evt_1', hasId: false },
    ])
    expect(retries).toEqual([3000])
  })

  it('ignores frames without data and unknown fields', () => {
    const parser = new SseParser()
    expect(parser.feed('id: evt_2\n\nevent: x\nfoo\n\n')).toEqual([])
    expect(parser.lastEventId).toBe('evt_2')
  })
})
