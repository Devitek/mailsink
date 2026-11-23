import { describe, expect, it } from 'vitest'
import { InboxSearch, PickerSearch } from './search-params'

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
