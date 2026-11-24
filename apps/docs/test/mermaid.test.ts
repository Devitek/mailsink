import { readFileSync } from 'node:fs'
import { markdownToHtml } from 'satteri'
import { describe, expect, it, vi } from 'vitest'
import { exposeWidth, themeOf } from '../src/mermaid/client'
import { parseDiagram } from '../src/mermaid/parse'
import { FIGURE_CLASS, type MermaidPluginOptions, mermaidPlugin } from '../src/mermaid/plugin'
import { readColors, themeVariables } from '../src/mermaid/theme'

const page = [
  '```mermaid',
  'sequenceDiagram',
  '  A->>B: a < b & c',
  '```',
  '',
  '```ts',
  'const a = 1',
  '```',
  '',
  '> ```mermaid',
  '> erDiagram',
  '> ```',
].join('\n')

async function html(options: MermaidPluginOptions): Promise<string> {
  const result = await markdownToHtml(page, {
    mdastPlugins: [mermaidPlugin(options)],
    fileURL: new URL('file:///docs/x.md'),
  })
  return result.html
}

const valid = () => Promise.resolve()

describe('mermaidPlugin', () => {
  it('turns every mermaid block, nested ones included, into a figure holding its source', async () => {
    const out = await html({ parse: valid })
    expect(out.match(new RegExp(`<figure class="${FIGURE_CLASS}">`, 'g'))).toHaveLength(2)
    expect(out).toContain(
      `<figure class="${FIGURE_CLASS}"><pre class="${FIGURE_CLASS}-source">sequenceDiagram\n  A-&gt;&gt;B: a &lt; b &amp; c</pre></figure>`,
    )
    expect(out).toContain('<blockquote>')
    expect(out).toContain('language-ts')
    expect(out).not.toContain('language-mermaid')
  })

  it('fails the build when a diagram does not parse, naming the page', async () => {
    const parse = () => Promise.reject(new Error('Parse error on line 2'))
    await expect(html({ parse })).rejects.toThrow(/\/docs\/x\.md: mermaid diagram does not parse/)
  })

  it('reports and keeps the figure when an error handler is given (dev server)', async () => {
    const onError = vi.fn()
    const out = await html({ parse: () => Promise.reject(new Error('bad')), onError })
    expect(onError).toHaveBeenCalledWith(expect.any(Error), '/docs/x.md')
    expect(out.match(new RegExp(`<figure class="${FIGURE_CLASS}">`, 'g'))).toHaveLength(2)
  })
})

describe('parseDiagram', () => {
  it('parses with Mermaid in Node, without a browser', async () => {
    await expect(parseDiagram('sequenceDiagram\n  A->>B: hi, there')).resolves.toBeTruthy()
  })

  it('rejects a broken diagram, such as a `;` inside a message', async () => {
    await expect(parseDiagram('sequenceDiagram\n  A->>B: hi; there')).rejects.toThrow(/Parse/)
  })
})

describe('client helpers', () => {
  it('follows the Starlight theme, light unless dark', () => {
    expect(themeOf('dark')).toBe('dark')
    expect(themeOf('light')).toBe('light')
    expect(themeOf(undefined)).toBe('light')
  })

  it('hands the diagram width to the stylesheet through a CSS variable on the root SVG', () => {
    const svg = '<svg id="m" width="100%" style="max-width: 4693.6px;"><g style="x"></g></svg>'
    expect(exposeWidth(svg)).toBe(
      '<svg id="m" width="100%" style="--mermaid-width: 4694px; max-width: 4693.6px;"><g style="x"></g></svg>',
    )
    expect(exposeWidth('<svg id="m"></svg>')).toBe('<svg id="m"></svg>')
  })
})

describe('themeVariables', () => {
  const css = `:root, [data-theme="light"] {
  --ms-bg: #f5f5f3;
  --ms-accent: oklch(0.86 0.16 92); /* #f7cd3a */
  --ms-status-x: oklch(0.5 0.1 1);
}
[data-theme="dark"] {
  --ms-bg: #0b0c0e; /* #0b0c0e */
}`

  it('reads the hex value of each token, or the hex comment of an oklch value', () => {
    expect(readColors(css, 'light')).toEqual({ bg: '#f5f5f3', accent: '#f7cd3a' })
    expect(readColors(css, 'dark')).toEqual({ bg: '#0b0c0e' })
  })

  it('maps every variable onto a token of the real tokens file, in both themes', () => {
    const tokens = readFileSync(
      new URL('../../../docs/design/brand-1/tokens/tokens.css', import.meta.url),
      'utf8',
    )
    const light = themeVariables(tokens, 'light')
    const dark = themeVariables(tokens, 'dark')
    expect(light.darkMode).toBe(false)
    expect(dark.darkMode).toBe(true)
    expect(light.background).not.toBe(dark.background)
  })

  it('fails when a token it needs has no hex value', () => {
    expect(() => themeVariables(css, 'dark')).toThrow(/--ms-panel/)
  })
})
