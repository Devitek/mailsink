import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Definition of Done for the inbox screens (#39, #40): design tokens only. Sizes may be in
// pixels; colours, fonts and radii come from the --ms-* tokens (same rules as @mailsink/ui).
const folders = ['inbox', 'message-viewer', 'realtime']
const sources = folders.flatMap((folder) => {
  const dir = new URL(`../${folder}/`, import.meta.url)
  return readdirSync(dir)
    .filter((file) => file.endsWith('.tsx') && !file.includes('.test.'))
    .map((file) => [`${folder}/${file}`, readFileSync(new URL(file, dir), 'utf8')] as const)
})

const FORBIDDEN: [string, RegExp][] = [
  ['hex colour', /#[0-9a-f]{3,8}\b/i],
  ['colour function', /\b(rgba?|hsla?|oklch|oklab)\(/],
  ['named colour', /\b(bg|text|border|fill|stroke|ring|shadow)-(white|black)\b/],
  ['default palette', /-(red|blue|green|gray|zinc|slate|neutral|yellow)-\d{2,3}\b/],
  ['arbitrary radius', /rounded(-[trbl]{1,2})?-\[/],
  ['font family', /font-\[|fontFamily/],
]

describe('inbox screens use tokens only', () => {
  it('finds the sources', () => {
    expect(sources.length).toBeGreaterThanOrEqual(12)
  })

  for (const [file, source] of sources) {
    it(file, () => {
      const hits = FORBIDDEN.filter(([, pattern]) => pattern.test(source)).map(([name]) => name)
      expect(hits).toEqual([])
    })
  }
})
