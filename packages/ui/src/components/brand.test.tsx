import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Mark, markStrokeWidth } from './brand'

describe('markStrokeWidth', () => {
  // BRAND.md construction: 5.5 u, thickened at small sizes.
  it('thickens the stroke as the mark gets smaller', () => {
    expect(markStrokeWidth(16)).toBe(7)
    expect(markStrokeWidth(20)).toBe(6.5)
    expect(markStrokeWidth(24)).toBe(6.5)
    expect(markStrokeWidth(32)).toBe(6)
    expect(markStrokeWidth(64)).toBe(5.5)
  })
})

describe('Mark', () => {
  it('paints the tile and the arrow with the accent tokens', () => {
    const html = renderToStaticMarkup(<Mark size={20} />)
    expect(html).toContain('fill="var(--ms-accent)"')
    expect(html).toContain('stroke="var(--ms-on-accent)"')
    expect(html).toContain('stroke-width="6.5"')
    expect(html).toContain('aria-hidden="true"')
  })
})
