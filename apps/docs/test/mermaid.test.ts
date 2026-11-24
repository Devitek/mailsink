import { readFileSync } from 'node:fs'
import { markdownToHtml } from 'satteri'
import { describe, expect, it, vi } from 'vitest'
import { FIGURE_CLASS, type MermaidPluginOptions, mermaidPlugin } from '../src/mermaid/plugin'
import { exposeWidth } from '../src/mermaid/render'
import { readColors, themeVariables } from '../src/mermaid/theme'

const page = [
  '```mermaid',
  'sequenceDiagram',
  '  A->>B: hi',
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

const fake: MermaidPluginOptions['render'] = async (diagram, theme, id) =>
  `<svg id="${id}" data-theme="${theme}">${diagram.split('\n')[0]}</svg>`

async function html(options: MermaidPluginOptions): Promise<string> {
  const result = await markdownToHtml(page, {
    mdastPlugins: [mermaidPlugin(options)],
    fileURL: new URL('file:///docs/x.md'),
  })
  return result.html
}

describe('mermaidPlugin', () => {
  it('replaces every mermaid block, nested ones included, by a light and a dark SVG', async () => {
    const out = await html({ render: fake })
    expect(out.match(new RegExp(`<figure class="${FIGURE_CLASS}">`, 'g'))).toHaveLength(2)
    expect(out).toMatch(
      new RegExp(
        `<div class="${FIGURE_CLASS}-light"><svg id="mermaid-light-[0-9a-f]{10}" data-theme="light">sequenceDiagram</svg></div><div class="${FIGURE_CLASS}-dark"><svg id="mermaid-dark-[0-9a-f]{10}" data-theme="dark">`,
      ),
    )
    expect(out).toContain('<blockquote>')
    expect(out).toContain('language-ts')
    expect(out).not.toContain('language-mermaid')
  })

  it('gives each diagram its own id, so the styles Mermaid scopes by id never collide', async () => {
    const out = await html({ render: fake })
    const ids = [...out.matchAll(/id="(mermaid-[a-z]+-[0-9a-f]+)"/g)].map((match) => match[1])
    expect(new Set(ids).size).toBe(4)
  })

  it('fails the build when a diagram does not render, naming the page', async () => {
    const render = () => Promise.reject(new Error('Parse error on line 2'))
    await expect(html({ render })).rejects.toThrow(/\/docs\/x\.md: mermaid rendering failed/)
  })

  it('leaves the blocks as code and reports when an error handler is given (dev server)', async () => {
    const onError = vi.fn()
    const out = await html({ render: () => Promise.reject(new Error('no browser')), onError })
    expect(onError).toHaveBeenCalledWith(expect.any(Error), '/docs/x.md')
    expect(out).toContain('language-mermaid')
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

describe('exposeWidth', () => {
  it('hands the diagram width to the stylesheet through a CSS variable on the root SVG', () => {
    const svg = '<svg id="m" width="100%" style="max-width: 4694px;"><g style="x"></g></svg>'
    expect(exposeWidth(svg, 4693.6)).toBe(
      '<svg id="m" width="100%" style="--mermaid-width: 4694px; max-width: 4694px;"><g style="x"></g></svg>',
    )
  })
})
