import { describe, expect, it } from 'vitest'
import {
  apiQueryOf,
  changeSearch,
  deliveriesQueryOf,
  smtpQueryOf,
  sortFromSorting,
  sortingOf,
  sortOf,
  tabOf,
} from './search-query'

describe('logs search queries', () => {
  it('resolves the defaults of an empty URL', () => {
    expect(tabOf({})).toBe('api')
    expect(apiQueryOf({})).toEqual({ sort: '-createdAt', page: 1, pageSize: 50 })
    expect(smtpQueryOf({})).toEqual({ sort: '-startedAt', page: 1, pageSize: 50 })
    expect(deliveriesQueryOf({})).toEqual({ limit: 50 })
  })

  it('maps the API filters, the search box on the path', () => {
    expect(
      apiQueryOf({
        q: '/emails',
        connectionId: 'con_1',
        dialect: ['resend'],
        code: ['4xx'],
        sort: 'durationMs',
        page: 2,
        pageSize: 25,
      }),
    ).toEqual({
      path: '/emails',
      connectionId: 'con_1',
      dialect: ['resend'],
      status: ['4xx'],
      sort: 'durationMs',
      page: 2,
      pageSize: 25,
    })
  })

  it('maps the SMTP filters and its time-only sort', () => {
    expect(
      smtpQueryOf({ tab: 'smtp', q: 'relay', outcome: ['auth_failed'], sort: 'createdAt' }),
    ).toEqual({ q: 'relay', outcome: ['auth_failed'], sort: 'startedAt', page: 1, pageSize: 50 })
    expect(sortOf({ tab: 'smtp', sort: 'durationMs' })).toBe('-createdAt')
    expect(sortOf({ tab: 'api', sort: 'durationMs' })).toBe('durationMs')
  })

  it('maps the webhook facets and the keyset cursor', () => {
    expect(
      deliveriesQueryOf({
        tab: 'webhooks',
        endpointId: 'whe_1',
        format: 'brevo',
        delivery: 'failed',
        cursor: 'whd_9',
        pageSize: 100,
      }),
    ).toEqual({
      endpointId: 'whe_1',
      payloadFormat: 'brevo',
      status: 'failed',
      cursor: 'whd_9',
      limit: 100,
    })
  })

  it('goes back to the first page and closes the sheet when a filter changes', () => {
    const prev = { page: 3, inspect: 'req_1', dialect: ['resend' as const] }
    expect(changeSearch(prev, { dialect: ['mcp'] })).toEqual({ dialect: ['mcp'] })
    expect(changeSearch(prev, { page: 4 })).toEqual({ ...prev, page: 4 })
    expect(changeSearch(prev, { inspect: 'req_2' })).toEqual({ ...prev, inspect: 'req_2' })
    expect(changeSearch(prev, { dialect: undefined, inspect: 'req_1' })).toEqual({
      inspect: 'req_1',
    })
  })

  it('drops the facets of another tab and keeps the page size', () => {
    const prev = { q: 'x', dialect: ['resend' as const], pageSize: 100, page: 2 }
    expect(changeSearch(prev, { tab: 'smtp' })).toEqual({ tab: 'smtp', pageSize: 100 })
    expect(changeSearch({ tab: 'smtp', cursor: undefined }, { tab: 'api' })).toEqual({})
  })

  it('maps the URL sort to the table sorting state and back', () => {
    expect(sortingOf('-durationMs')).toEqual([{ id: 'durationMs', desc: true }])
    expect(sortingOf('createdAt')).toEqual([{ id: 'createdAt', desc: false }])
    expect(sortFromSorting([{ id: 'statusCode', desc: false }])).toBe('statusCode')
    expect(sortFromSorting([{ id: 'createdAt', desc: true }])).toBeUndefined()
    expect(sortFromSorting([{ id: 'path', desc: true }])).toBeUndefined()
    expect(sortFromSorting([])).toBeUndefined()
  })
})
