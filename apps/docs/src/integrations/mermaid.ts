// Mermaid on the site (D270): adds the plugin (src/mermaid/plugin.ts) to Astro's Sätteri
// Markdown processor, the way Expressive Code adds its own, and injects the browser script
// (src/mermaid/client.ts) with the light and dark theme variables read from the design
// tokens. `astro build` fails on a diagram that does not parse; `astro dev` warns and keeps
// the figure, which then shows its source. No browser is needed at build.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { AstroIntegration } from 'astro'
import type { MdastPluginEntry } from 'satteri'
import type { MermaidThemes } from '../mermaid/client'
import { parseDiagram } from '../mermaid/parse'
import { mermaidPlugin } from '../mermaid/plugin'
import { themeVariables } from '../mermaid/theme'

const CLIENT = fileURLToPath(new URL('../mermaid/client.ts', import.meta.url))

function mdastPlugins(processor: unknown): MdastPluginEntry[] {
  const options = processor as { name?: string; options?: { mdastPlugins?: unknown } } | undefined
  if (options?.name !== 'satteri' || !Array.isArray(options.options?.mdastPlugins)) {
    throw new Error('mailsink:mermaid needs the Sätteri Markdown processor (markdown.processor)')
  }
  return options.options.mdastPlugins
}

export function mermaid(tokensPath: string): AstroIntegration {
  return {
    name: 'mailsink:mermaid',
    hooks: {
      'astro:config:setup': ({ command, config, injectScript, logger }) => {
        const onError =
          command === 'build'
            ? undefined
            : (error: unknown, path: string | undefined) =>
                logger.warn(`${path}: mermaid diagram does not parse (${String(error)})`)
        mdastPlugins(config.markdown.processor).push(
          mermaidPlugin({ parse: parseDiagram, onError }),
        )
        const css = readFileSync(tokensPath, 'utf8')
        const themes: MermaidThemes = {
          light: themeVariables(css, 'light'),
          dark: themeVariables(css, 'dark'),
        }
        injectScript(
          'page',
          `import { startMermaid } from ${JSON.stringify(CLIENT)}\nstartMermaid(${JSON.stringify(themes)})`,
        )
      },
    },
  }
}
