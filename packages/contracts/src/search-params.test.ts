import { describe, expect, it } from 'vitest'
import { InboxSearch, LogsSearch, PickerSearch } from './search-params'

describe('PickerSearch', () => {
  it('hides ephemeral workspaces by default', () => {
    expect(PickerSearch.parse({})).toEqual({ ephemeral: false })
    expect(PickerSearch.parse({ ephemeral: true })).toEqual({ ephemeral: true })
    expect(PickerSearch.safeParse({ ephemeral: 'yes' }).success).toBe(false)
  })
})

describe('InboxSearch', () => {
  it('keeps valid filters, the open message and its tab', () => {
    const search = {
      q: 'invoice',
      status: 'hard_bounce',
      connectionId: 'con_abc',
      tag: 'category:booking',
      m: 'msg_123',
      tab: 'history',
    }
    expect(InboxSearch.parse(search)).toEqual(search)
    expect(InboxSearch.parse({})).toEqual({})
  })

  it('reads numbers parsed by the router as text and trims the search', () => {
    expect(InboxSearch.parse({ q: 2026, tag: '  env  ' })).toEqual({ q: '2026', tag: 'env' })
  })

  it('drops invalid values instead of failing the page', () => {
    expect(
      InboxSearch.parse({
        q: '   ',
        status: 'lost',
        connectionId: 'ws_1',
        m: 'nope',
        tab: 'raw',
        tag: { name: 'x' },
      }),
    ).toEqual({})
  })
})

describe('LogsSearch', () => {
  it('keeps the tab, the filters, the sort, the page and the inspected row', () => {
    const search = {
      tab: 'api',
      q: '/emails',
      connectionId: 'con_abc',
      dialect: ['resend', 'brevo'],
      code: ['4xx', '201'],
      sort: '-durationMs',
      page: 3,
      pageSize: 100,
      inspect: 'req_123',
    }
    expect(LogsSearch.parse(search)).toEqual(search)
    expect(LogsSearch.parse({})).toEqual({})
  })

  it('reads the facets of the SMTP and webhook tabs', () => {
    const search = {
      tab: 'webhooks',
      outcome: ['auth_failed'],
      delivery: 'failed',
      format: 'resend',
      endpointId: 'whe_1',
      cursor: 'whd_9',
    }
    expect(LogsSearch.parse(search)).toEqual(search)
  })

  it('reads comma-separated facets and numbers parsed by the router', () => {
    expect(LogsSearch.parse({ dialect: 'resend,mcp', q: 404, page: '2' })).toEqual({
      dialect: ['resend', 'mcp'],
      q: '404',
      page: 2,
    })
  })

  it('drops invalid values instead of failing the page', () => {
    expect(
      LogsSearch.parse({
        tab: 'jobs',
        dialect: ['resend', 'sendgrid'],
        code: ['600'],
        outcome: 'lost',
        delivery: ['failed'],
        format: 'mailgun',
        sort: 'subject',
        page: 0,
        pageSize: 5000,
        inspect: { id: 1 },
        connectionId: 'ws_1',
        endpointId: 'con_1',
        cursor: 'nope',
      }),
    ).toEqual({})
  })
})
