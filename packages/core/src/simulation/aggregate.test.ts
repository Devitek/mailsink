import { describe, expect, it } from 'vitest'
import { aggregateStatus } from './aggregate'

describe('aggregateStatus', () => {
  it('is suppressed only when every recipient is', () => {
    expect(aggregateStatus(['suppressed', 'suppressed'])).toBe('suppressed')
    expect(aggregateStatus(['suppressed', 'delivered'])).toBe('delivered')
  })

  it('reports the least advanced recipient while any is in flight', () => {
    expect(aggregateStatus(['delivered', 'queued', 'sent'])).toBe('queued')
    expect(aggregateStatus(['delivered', 'sent', 'deferred'])).toBe('deferred')
    expect(aggregateStatus(['delivered', 'sent'])).toBe('sent')
  })

  it('reports the most severe final status once all are final', () => {
    expect(aggregateStatus(['delivered', 'delivered'])).toBe('delivered')
    expect(aggregateStatus(['delivered', 'complained'])).toBe('complained')
    expect(aggregateStatus(['soft_bounce', 'hard_bounce', 'delivered'])).toBe('hard_bounce')
    expect(aggregateStatus(['hard_bounce', 'failed'])).toBe('failed')
    expect(aggregateStatus(['hard_bounce', 'invalid'])).toBe('invalid')
    expect(aggregateStatus(['invalid', 'failed'])).toBe('failed')
  })

  it('has nothing to aggregate without recipients', () => {
    expect(aggregateStatus([])).toBeUndefined()
  })
})
