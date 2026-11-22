import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Definition of Done: design system tokens only. Components may size things in pixels, but
// colours, fonts and radii must come from the --ms-* tokens through theme.css.
const dir = new URL('./', import.meta.url)
const sources = readdirSync(dir)
  .filter((file) => file.endsWith('.tsx') && !file.endsWith('.test.tsx'))
  .map((file) => [file, readFileSync(new URL(file, dir), 'utf8')] as const)

const FORBIDDEN: [string, RegExp][] = [
  ['hex colour', /#[0-9a-f]{3,8}\b/i],
  ['colour function', /\b(rgba?|hsla?|oklch|oklab)\(/],
  ['named colour', /\b(bg|text|border|fill|stroke|ring|shadow)-(white|black)\b/],
  ['default palette', /-(red|blue|green|gray|zinc|slate|neutral|yellow)-\d{2,3}\b/],
  ['arbitrary radius', /rounded(-[trbl]{1,2})?-\[/],
  ['font family', /font-\[|fontFamily/],
]

describe('components use tokens only', () => {
  it('finds the component sources', () => {
    expect(sources.length).toBeGreaterThanOrEqual(6)
  })

  for (const [file, source] of sources) {
    it(file, () => {
      const hits = FORBIDDEN.filter(([, pattern]) => pattern.test(source)).map(([name]) => name)
      expect(hits).toEqual([])
    })
  }
})
