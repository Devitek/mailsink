// Browser side of the Mermaid diagrams (D270), injected on every page by
// src/integrations/mermaid.ts: on a page holding figures (src/mermaid/plugin.ts) it loads
// Mermaid, a chunk of its own fetched only there, draws each diagram in the theme matching
// Starlight's `data-theme`, and draws them again when the theme selector changes it.
import type { Mermaid } from 'mermaid'
import { FIGURE_CLASS, SOURCE_CLASS } from './plugin'
import type { ThemeName } from './theme'

export type MermaidThemes = Record<ThemeName, Record<string, string | boolean>>

export function themeOf(attribute: string | undefined): ThemeName {
  return attribute === 'dark' ? 'dark' : 'light'
}

/**
 * Mermaid sizes the SVG to its container (`width="100%"`, `max-width` its own width), which
 * shrinks a wide sequence diagram to unreadable text. Its own width goes to a CSS variable,
 * so src/styles/mermaid.css can bound the shrinking and let the figure scroll instead.
 */
export function exposeWidth(svg: string): string {
  const width = /^<svg\b[^>]*?\sstyle="[^"]*max-width:\s*([\d.]+)px/.exec(svg)?.[1]
  if (!width) return svg
  return svg.replace(
    /^(<svg\b[^>]*?\sstyle=")/,
    `$1--mermaid-width: ${Math.ceil(Number(width))}px; `,
  )
}

export function startMermaid(themes: MermaidThemes): void {
  const figures = [...document.querySelectorAll<HTMLElement>(`figure.${FIGURE_CLASS}`)]
  if (figures.length === 0) return
  const sources = figures.map((figure) => figure.querySelector(`.${SOURCE_CLASS}`)?.textContent)
  const root = document.documentElement
  let loading: Promise<Mermaid> | undefined
  let drawn: ThemeName | undefined
  let run = 0
  let queue = Promise.resolve()

  const draw = async (theme: ThemeName) => {
    if (theme === drawn) return
    loading ??= import('mermaid').then(({ default: mermaid }) => mermaid)
    const mermaid = await loading
    mermaid.initialize({ startOnLoad: false, theme: 'base', themeVariables: themes[theme] })
    run += 1
    for (const [index, figure] of figures.entries()) {
      const source = sources[index]
      if (!source) continue
      try {
        const { svg, bindFunctions } = await mermaid.render(`ms-mermaid-${index}-${run}`, source)
        let target = figure.querySelector<HTMLElement>(`.${FIGURE_CLASS}-svg`)
        if (!target) {
          target = document.createElement('div')
          target.className = `${FIGURE_CLASS}-svg`
          figure.append(target)
        }
        target.innerHTML = exposeWidth(svg)
        bindFunctions?.(target)
        figure.dataset.rendered = theme
      } catch (error) {
        // The source stays shown: a reader still gets the diagram as text.
        console.error('mermaid: diagram not rendered', error)
      }
    }
    drawn = theme
  }
  const redraw = () => {
    queue = queue.then(() => draw(themeOf(root.dataset.theme)))
  }
  new MutationObserver(redraw).observe(root, { attributes: true, attributeFilter: ['data-theme'] })
  redraw()
}
