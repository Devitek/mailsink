import type { SuppressionView } from '@mailsink/contracts'
import { describe, expect, it } from 'vitest'
import { filterPages } from './queries'

const row = (email: string) =>
  ({
    id: `sup_${email}`,
    email,
    reason: 'hard_bounce',
    messageId: null,
    createdAt: '2026-11-23T10:00:00.000Z',
  }) as SuppressionView

describe('suppression cache', () => {
  it('drops rows from every loaded page, keeping the cursors', () => {
    const data = {
      pageParams: [undefined, 'sup_b'],
      pages: [
        { data: [row('a@x.test'), row('b@x.test')], nextCursor: 'sup_b' },
        { data: [row('c@x.test')], nextCursor: null },
      ],
    }
    const next = filterPages(data, (email) => email !== 'b@x.test')
    expect(next?.pages.map((p) => p.data.map((r) => r.email))).toEqual([['a@x.test'], ['c@x.test']])
    expect(next?.pages[0]?.nextCursor).toBe('sup_b')
    expect(filterPages(undefined, () => false)).toBeUndefined()
  })
})
