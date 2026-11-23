import type { MessageSummary, StreamEvent } from '@mailsink/contracts'
import type { InboxPage } from '@mailsink/core'
import { type InfiniteData, QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ViewerMessage } from '../../server-fns/messages-types'
import { applyPreviews, applyStreamEvent } from './apply-stream-event'

const summary = (id: string, patch: Partial<MessageSummary> = {}): MessageSummary => ({
  id,
  connectionId: 'con_1',
  source: 'resend',
  from: { email: 'app@example.com', name: null },
  to: [{ email: 'jane@example.com', name: null }],
  subject: 'Hello',
  status: 'queued',
  tags: [],
  hasAttachments: false,
  createdAt: '2026-11-23T10:00:00.000Z',
  ...patch,
})

const page = (...ids: string[]): InfiniteData<InboxPage, string | undefined> => ({
  pages: [{ data: ids.map((id) => ({ ...summary(id), preview: `p ${id}` })), nextCursor: null }],
  pageParams: [undefined],
})

const ids = (qc: QueryClient, filters: object) =>
  qc
    .getQueryData<InfiniteData<InboxPage>>(['inbox', 'qa', 'list', filters])
    ?.pages.flatMap((p) => p.data.map((r) => `${r.id}:${r.status}:${r.preview}`))

describe('stream frames in the query cache', () => {
  let qc: QueryClient
  beforeEach(() => {
    qc = new QueryClient()
    qc.setQueryData(['inbox', 'qa', 'list', {}], page('msg_1'))
    qc.setQueryData(['inbox', 'qa', 'list', { status: 'failed' }], page())
    qc.setQueryData(['inbox', 'qa', 'list', { q: 'invoice' }], page())
    qc.setQueryData(['inbox', 'other', 'list', {}], page())
    qc.setQueryData(['inbox', 'qa', 'message', 'msg_1'], { ...summary('msg_1') } as ViewerMessage)
  })

  it('prepends a new message to the lists it belongs to, once', () => {
    const event: StreamEvent = { type: 'message.created', message: summary('msg_2') }
    const effects = applyStreamEvent(qc, 'qa', event)
    applyStreamEvent(qc, 'qa', event)
    expect(ids(qc, {})).toEqual(['msg_2:queued:', 'msg_1:queued:p msg_1'])
    expect(ids(qc, { status: 'failed' })).toEqual([])
    expect(effects.invalidate).toEqual([
      ['inbox', 'qa', 'list', { q: 'invoice' }],
      ['inbox', 'qa', 'facets'],
    ])
    expect(effects.previews).toEqual(['msg_2'])

    applyPreviews(qc, 'qa', { msg_2: 'Your booking' })
    expect(ids(qc, {})?.[0]).toBe('msg_2:queued:Your booking')
  })

  it('writes the aggregated status in the lists and the open message', () => {
    const effects = applyStreamEvent(qc, 'qa', {
      type: 'message.status',
      messageId: 'msg_1',
      status: 'delivered',
      recipient: null,
    })
    expect(ids(qc, {})).toEqual(['msg_1:delivered:p msg_1'])
    expect(qc.getQueryData<ViewerMessage>(['inbox', 'qa', 'message', 'msg_1'])?.status).toBe(
      'delivered',
    )
    expect(effects.invalidate).toContainEqual(['inbox', 'qa', 'message', 'msg_1'])
  })

  it('invalidates what only the server knows', () => {
    const event = (e: StreamEvent) => applyStreamEvent(qc, 'qa', e)
    expect(event({ type: 'messages.purged', count: 3 }).invalidate).toEqual([['inbox', 'qa']])
    expect(event({ type: 'log.api' } as StreamEvent).invalidate).toEqual([
      ['inbox', 'qa', 'facets'],
    ])
    expect(
      event({ type: 'message.event', messageId: 'msg_2', event: {} } as StreamEvent).invalidate,
    ).toEqual([['inbox', 'qa', 'message', 'msg_2']])
    expect(
      event({ type: 'webhook.delivery', delivery: { messageId: 'msg_1' } } as StreamEvent)
        .invalidate,
    ).toEqual([
      ['inbox', 'qa', 'message', 'msg_1'],
      ['inbox', 'qa', 'facets'],
    ])
    expect(event({ type: 'workspace.deleted', workspaceId: 'ws_1' }).deleted).toBe(true)
  })
})
