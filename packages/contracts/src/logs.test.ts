import { describe, expect, it } from 'vitest'
import { ListApiLogsQuery, ListSmtpSessionsQuery } from './logs'
import { StreamEvent, StreamQuery } from './stream'

const id = (prefix: string) => `${prefix}_0192f3a4-7b1c-7d2e-8f00-1234567890ab`

describe('ListApiLogsQuery', () => {
  it('defaults the sort and the page', () => {
    expect(ListApiLogsQuery.parse({})).toEqual({ sort: '-createdAt', page: 1, pageSize: 50 })
  })

  it('splits comma-separated dialects and statuses, upper-cases the method', () => {
    const q = ListApiLogsQuery.parse({
      dialect: 'native,capture',
      status: '4xx,500',
      method: 'post',
      page: '2',
      pageSize: '10',
    })
    expect(q).toMatchObject({
      dialect: ['native', 'capture'],
      status: ['4xx', '500'],
      method: 'POST',
      page: 2,
      pageSize: 10,
    })
  })

  it('rejects an unknown status filter, a page size above 200 and since after until', () => {
    expect(ListApiLogsQuery.safeParse({ status: '42' }).success).toBe(false)
    expect(ListApiLogsQuery.safeParse({ pageSize: 201 }).success).toBe(false)
    const since = '2026-11-23T10:00:00Z'
    const until = '2026-11-23T09:00:00Z'
    expect(ListApiLogsQuery.safeParse({ since, until }).success).toBe(false)
  })
})

describe('ListSmtpSessionsQuery', () => {
  it('splits outcomes', () => {
    expect(ListSmtpSessionsQuery.parse({ outcome: 'accepted,error' }).outcome).toEqual([
      'accepted',
      'error',
    ])
    expect(ListSmtpSessionsQuery.safeParse({ outcome: 'lost' }).success).toBe(false)
  })
})

describe('log stream events', () => {
  it('accepts log.api and log.smtp frames and their types', () => {
    const log = {
      id: id('req'),
      connectionId: null,
      dialect: 'native',
      method: 'POST',
      path: '/v1/emails',
      statusCode: 200,
      durationMs: 3,
      errorCode: null,
      messageIds: [id('msg')],
      createdAt: '2026-11-23T10:00:00.000Z',
    }
    expect(StreamEvent.parse({ type: 'log.api', log }).type).toBe('log.api')
    const session = {
      id: id('smtp'),
      connectionId: id('con'),
      remoteAddress: '127.0.0.1',
      clientHostname: null,
      authUser: 'user',
      secure: false,
      outcome: 'accepted',
      error: null,
      messageIds: [],
      startedAt: '2026-11-23T10:00:00.000Z',
      endedAt: null,
    }
    expect(StreamEvent.parse({ type: 'log.smtp', session }).type).toBe('log.smtp')
    expect(StreamQuery.parse({ types: 'log.api,log.smtp' }).types).toEqual(['log.api', 'log.smtp'])
  })
})
