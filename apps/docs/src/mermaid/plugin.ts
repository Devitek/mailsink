// Sätteri mdast plugin (Astro's Markdown processor): every ```mermaid code block becomes a
// figure holding the diagram source, which src/mermaid/client.ts renders in the browser in
// the theme of the site (D270). The source is parsed with Mermaid at build, which needs no
// browser, so a broken diagram still fails `astro build`. Mdast plugins run before
// Expressive Code (a hast plugin), so the blocks never reach the code highlighter. The
// Markdown sources are untouched: GitHub keeps rendering the same blocks itself.
import type { Code, Html } from 'mdast'
import type { MdastPluginDefinition } from 'satteri'

/** Rejects when the diagram does not parse (src/mermaid/parse.ts). */
export type MermaidParse = (diagram: string) => Promise<unknown>

export interface MermaidPluginOptions {
  parse: MermaidParse
  /** Called instead of throwing when a diagram does not parse (dev server). */
  onError?: (error: unknown, path: string | undefined) => void
}

export const FIGURE_CLASS = 'ms-mermaid'
export const SOURCE_CLASS = 'ms-mermaid-source'

function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

/** The renderable element: the source stays readable until the browser draws it. */
export function figure(diagram: string): string {
  return `<figure class="${FIGURE_CLASS}"><pre class="${SOURCE_CLASS}">${escapeHtml(diagram)}</pre></figure>`
}

export function mermaidPlugin(options: MermaidPluginOptions): MdastPluginDefinition {
  return {
    name: 'mailsink-mermaid',
    async code(node: Readonly<Code>, ctx): Promise<Html | undefined> {
      if (node.lang !== 'mermaid') return undefined
      const path = ctx.fileURL?.pathname
      try {
        await options.parse(node.value)
      } catch (error) {
        if (!options.onError) {
          throw new Error(`${path ?? 'markdown'}: mermaid diagram does not parse`, {
            cause: error,
          })
        }
        options.onError(error, path)
      }
      return { type: 'html', value: figure(node.value) }
    },
  }
}
