// The Mermaid renderer of the build: mermaid-isomorphic runs Mermaid in a headless Chromium
// through Playwright (`pnpm --filter @mailsink/docs exec playwright install chromium`), the
// only way to get Mermaid's own layout, the one GitHub shows, as static SVG (D270).
import { readFileSync } from 'node:fs'
import { createMermaidRenderer, type MermaidRenderer } from 'mermaid-isomorphic'
import type { MermaidRender } from './plugin'
import { type ThemeName, themeVariables } from './theme'

export function createRender(tokensPath: string): MermaidRender {
  const css = readFileSync(tokensPath, 'utf8')
  const config = (theme: ThemeName) => ({
    theme: 'base' as const,
    themeVariables: themeVariables(css, theme),
  })
  // One browser, shared by every page and closed when no diagram is rendering.
  let renderer: MermaidRenderer | undefined
  return async (diagram, theme, id) => {
    renderer ??= createMermaidRenderer()
    const [result] = await renderer([diagram], { prefix: id, mermaidConfig: config(theme) })
    if (!result) throw new Error('mermaid-isomorphic returned no result')
    if (result.status === 'rejected') throw result.reason
    return exposeWidth(result.value.svg, result.value.width)
  }
}

/**
 * Mermaid sizes the SVG to its container (`width="100%"`, `max-width` its own width), which
 * shrinks a wide sequence diagram to unreadable text. Its own width goes to a CSS variable,
 * so src/styles/mermaid.css can bound the shrinking and let the figure scroll instead.
 */
export function exposeWidth(svg: string, width: number): string {
  return svg.replace(/^(<svg\b[^>]*?\sstyle=")/, `$1--mermaid-width: ${Math.ceil(width)}px; `)
}
