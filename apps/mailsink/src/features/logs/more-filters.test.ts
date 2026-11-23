import { describe, expect, it } from 'vitest'
import {
  activeCount,
  changeOf,
  fromLocalInput,
  moreFiltersSchema,
  moreKeysOf,
  toLocalInput,
  valuesOf,
} from './more-filters'

const blank = { messageId: '', since: '', until: '', method: '', errorCode: '' }
const schema = moreFiltersSchema({ messageId: 'bad id', range: 'bad range' })

describe('logs « More filters »', () => {
  it('offers the filters each tab supports', () => {
    expect(moreKeysOf('api')).toEqual(['messageId', 'since', 'until', 'method', 'errorCode'])
    expect(moreKeysOf('smtp')).toEqual(['messageId', 'since', 'until'])
    expect(moreKeysOf('webhooks')).toEqual(['messageId'])
  })

  it('round-trips a date through the local input value', () => {
    const iso = fromLocalInput('2026-11-23T10:30')
    expect(iso).toMatch(/^2026-11-2\dT\d\d:30:00.000Z$/)
    expect(toLocalInput(iso)).toBe('2026-11-23T10:30')
    expect(fromLocalInput('')).toBeUndefined()
    expect(toLocalInput('nope')).toBe('')
  })

  it('writes only the keys of the tab, blank ones removed', () => {
    const values = { ...blank, messageId: ' msg_1 ', method: 'POST', errorCode: 'Rate_Limited' }
    expect(changeOf(values, 'api')).toEqual({
      messageId: 'msg_1',
      since: undefined,
      until: undefined,
      method: 'POST',
      errorCode: 'rate_limited',
    })
    expect(changeOf(values, 'webhooks')).toEqual({ messageId: 'msg_1' })
  })

  it('counts the active filters of the tab and reads them back', () => {
    const search = { messageId: 'msg_1', method: 'GET' }
    expect(activeCount(search, 'api')).toBe(2)
    expect(activeCount(search, 'smtp')).toBe(1)
    expect(valuesOf(search)).toEqual({ ...blank, messageId: 'msg_1', method: 'GET' })
  })

  it('refuses a malformed message id and a reversed range', () => {
    expect(schema.safeParse({ ...blank, messageId: 'req_1' }).success).toBe(false)
    expect(schema.safeParse({ ...blank, messageId: 'msg_01abc' }).success).toBe(true)
    const reversed = { ...blank, since: '2026-11-23T11:00', until: '2026-11-23T10:00' }
    expect(schema.safeParse(reversed).error?.issues[0]?.path).toEqual(['until'])
  })
})
