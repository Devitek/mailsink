import { DeliveryStatus } from '@mailsink/contracts'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StatusBadge, statusColorVar } from './status-badge'

describe('statusColorVar', () => {
  it('maps every delivery status to its --ms-status token', () => {
    expect(statusColorVar('delivered')).toBe('var(--ms-status-delivered)')
    expect(statusColorVar('soft_bounce')).toBe('var(--ms-status-soft-bounce)')
    expect(statusColorVar('hard_bounce')).toBe('var(--ms-status-hard-bounce)')
    for (const status of DeliveryStatus.options) {
      expect(statusColorVar(status)).toMatch(/^var\(--ms-status-[a-z-]+\)$/)
    }
  })
})

describe('StatusBadge', () => {
  it('shows the raw status in mono, coloured by its token', () => {
    const html = renderToStaticMarkup(<StatusBadge status="soft_bounce" />)
    expect(html).toContain('>soft_bounce<')
    expect(html).toContain('font-mono')
    expect(html).toContain('--status:var(--ms-status-soft-bounce)')
    expect(html).toContain('data-status="soft_bounce"')
  })

  it('renders the leading dot on request', () => {
    expect(renderToStaticMarkup(<StatusBadge status="failed" />)).not.toContain('data-dot')
    expect(renderToStaticMarkup(<StatusBadge status="failed" dot />)).toContain('data-dot')
  })
})
