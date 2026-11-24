// Adds the Mermaid plugin (src/mermaid/plugin.ts, D270) to Astro's Sätteri Markdown
// processor, the way Expressive Code adds its own. `astro build` fails on a diagram that
// does not render; `astro dev` keeps it as code with a warning, so the site can be
// previewed without the Playwright browser; `astro sync` (types, run by `typecheck`) also
// renders the content, so it leaves the diagrams alone.
import type { AstroIntegration } from 'astro'
import type { MdastPluginEntry } from 'satteri'
import { mermaidPlugin } from '../mermaid/plugin'
import { createRender } from '../mermaid/render'

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
      'astro:config:setup': ({ command, config, logger }) => {
        if (command !== 'build' && command !== 'dev') return
        const onError =
          command === 'dev'
            ? (error: unknown, path: string | undefined) =>
                logger.warn(`${path}: diagram left as code (${String(error)})`)
            : undefined
        const plugin = mermaidPlugin({ render: createRender(tokensPath), onError })
        mdastPlugins(config.markdown.processor).push(plugin)
      },
    },
  }
}
