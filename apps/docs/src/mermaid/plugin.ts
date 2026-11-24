// Sätteri mdast plugin (Astro's Markdown processor): every ```mermaid code block becomes an
// inline SVG figure at build time (D270), rendered twice, once per site theme, the CSS
// showing the one matching `data-theme` (src/styles/mermaid.css). Mdast plugins run before
// Expressive Code (a hast plugin), so the blocks never reach the code highlighter. The
// Markdown sources are untouched: GitHub keeps rendering the same blocks itself.
import { createHash } from 'node:crypto'
import type { Code, Html } from 'mdast'
import type { MdastPluginDefinition } from 'satteri'
import type { ThemeName } from './theme'

/** Renders one diagram in one theme; `id` is unique to the diagram and theme. */
export type MermaidRender = (diagram: string, theme: ThemeName, id: string) => Promise<string>

export interface MermaidPluginOptions {
  render: MermaidRender
  /** Called instead of throwing when rendering fails (dev server); the block stays as code. */
  onError?: (error: unknown, path: string | undefined) => void
}

export const FIGURE_CLASS = 'ms-mermaid'

export function figure(light: string, dark: string): string {
  return [
    `<figure class="${FIGURE_CLASS}">`,
    `<div class="${FIGURE_CLASS}-light">${light}</div>`,
    `<div class="${FIGURE_CLASS}-dark">${dark}</div>`,
    '</figure>',
  ].join('')
}

/** Both SVGs of a figure share the page, and Mermaid scopes each one's styles by its id. */
function diagramId(diagram: string, theme: ThemeName): string {
  return `mermaid-${theme}-${createHash('sha256').update(diagram).digest('hex').slice(0, 10)}`
}

export function mermaidPlugin(options: MermaidPluginOptions): MdastPluginDefinition {
  return {
    name: 'mailsink-mermaid',
    async code(node: Readonly<Code>, ctx): Promise<Html | undefined> {
      if (node.lang !== 'mermaid') return undefined
      const path = ctx.fileURL?.pathname
      try {
        const [light, dark] = await Promise.all(
          (['light', 'dark'] as const).map((theme) =>
            options.render(node.value, theme, diagramId(node.value, theme)),
          ),
        )
        return { type: 'html', value: figure(light ?? '', dark ?? '') }
      } catch (error) {
        if (!options.onError) {
          throw new Error(`${path ?? 'markdown'}: mermaid rendering failed`, { cause: error })
        }
        options.onError(error, path)
        return undefined
      }
    },
  }
}
