import { describe, expect, it } from 'vitest'
import { BrevoBlockedContactsQuery, BrevoListEmailsQuery, brevoMonthEnd } from './brevo-read'
import { issueCode } from './common'

const codes = (
  schema: typeof BrevoListEmailsQuery | typeof BrevoBlockedContactsQuery,
  q: unknown,
) => schema.safeParse(q).error?.issues.map((i) => issueCode(i) ?? i.code) ?? []

describe('BrevoListEmailsQuery', () => {
  it('applies the documented defaults and coerces query strings', () => {
    expect(BrevoListEmailsQuery.parse({ email: 'Jane@Example.com', templateId: '3' })).toEqual({
      email: 'jane@example.com',
      templateId: 3,
      sort: 'desc',
      limit: 500,
      offset: 0,
    })
  })

  it('needs email, templateId or messageId, and both dates within one month', () => {
    expect(codes(BrevoListEmailsQuery, {})).toEqual(['filter_required'])
    expect(codes(BrevoListEmailsQuery, { messageId: '<a@b>', startDate: '2026-11-01' })).toEqual([
      'date_range_required',
    ])
    const range = (startDate: string, endDate: string) =>
      codes(BrevoListEmailsQuery, { email: 'a@b.io', startDate, endDate })
    expect(range('2026-01-31', '2026-02-28')).toEqual([])
    expect(range('2026-01-31', '2026-03-01')).toEqual(['date_range_too_long'])
    expect(range('2026-02-10', '2026-02-01')).toEqual(['date_range_order'])
    expect(range('2026-02-30', '2026-03-01')).toEqual(['custom'])
    expect(codes(BrevoListEmailsQuery, { email: 'a@b.io', limit: '501' })).toEqual(['too_big'])
  })

  it('computes the end of a one month window', () => {
    expect(brevoMonthEnd('2026-01-15')).toBe('2026-02-15')
    expect(brevoMonthEnd('2026-01-31')).toBe('2026-02-28')
    expect(brevoMonthEnd('2026-12-31')).toBe('2027-01-31')
  })
})

describe('BrevoBlockedContactsQuery', () => {
  it('defaults to 50 per page and reads senders comma separated or repeated', () => {
    expect(BrevoBlockedContactsQuery.parse({ senders: ['A@x.io,b@x.io', 'a@x.io'] })).toEqual({
      limit: 50,
      offset: 0,
      sort: 'desc',
      senders: ['a@x.io', 'b@x.io'],
    })
  })

  it('refuses a lone date, a future date and a limit above 100', () => {
    expect(codes(BrevoBlockedContactsQuery, { endDate: '2026-01-01' })).toEqual([
      'date_range_required',
    ])
    expect(
      codes(BrevoBlockedContactsQuery, { startDate: '2026-01-01', endDate: '2999-01-01' }),
    ).toEqual(['date_in_future'])
    expect(codes(BrevoBlockedContactsQuery, { limit: 101 })).toEqual(['too_big'])
  })
})
