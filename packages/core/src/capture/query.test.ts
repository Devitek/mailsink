import { ListMessagesQuery } from '@mailsink/contracts'
import { describe, expect, it } from 'vitest'
import { encodeCursor } from './cursor'
import { parseTagFilter, toMessageSearch } from './query'

const parse = (q: Record<string, unknown>) => ListMessagesQuery.parse(q)

describe('capture query', () => {
  it('parses tag filters on the first colon', () => {
    expect(parseTagFilter('category')).toEqual({ name: 'category' })
    expect(parseTagFilter('category:welcome')).toEqual({ name: 'category', value: 'welcome' })
    expect(parseTagFilter('url:https://x.io')).toEqual({ name: 'url', value: 'https://x.io' })
    expect(parseTagFilter('empty:')).toEqual({ name: 'empty', value: '' })
  })

  it('maps the contract query to repository filters', () => {
    const cursor = encodeCursor({ createdAt: '2026-11-22T10:00:00.000000Z', id: 'msg_1' })
    const search = toMessageSearch(
      'ws_1',
      parse({
        to: 'jane',
        status: 'delivered,failed',
        tag: 'a:b',
        since: '2026-11-01T00:00:00Z',
        q: '  reset  ',
        cursor,
        limit: '10',
      }),
    )
    expect(search).toMatchObject({
      workspaceId: 'ws_1',
      to: 'jane',
      statuses: ['delivered', 'failed'],
      tag: { name: 'a', value: 'b' },
      since: new Date('2026-11-01T00:00:00Z'),
      q: 'reset',
      after: { createdAt: '2026-11-22T10:00:00.000000Z', id: 'msg_1' },
      limit: 10,
    })
  })

  it('refuses wait=true until long polling lands (#26)', () => {
    expect(() => toMessageSearch('ws_1', parse({ wait: 'true' }))).toThrow(
      expect.objectContaining({
        status: 422,
        details: { in: 'query', issues: [expect.objectContaining({ path: ['wait'] })] },
      }),
    )
  })
})
