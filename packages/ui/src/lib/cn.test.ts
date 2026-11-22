import { describe, expect, it } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('keeps a brand font size next to a brand colour', () => {
    expect(cn('text-sm text-ms-text-muted')).toBe('text-sm text-ms-text-muted')
  })

  it('lets the last control height win', () => {
    expect(cn('h-control-md px-3', 'h-control-lg')).toBe('px-3 h-control-lg')
  })

  it('lets the last radius win', () => {
    expect(cn('rounded-md', 'rounded-xs')).toBe('rounded-xs')
  })
})
