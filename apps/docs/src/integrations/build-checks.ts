// Fails `astro build` when the built site is unsound (scripts/checks/dist.ts): a Mermaid
// block left as code, a page with fewer renderable diagrams than its source, or an internal
// link to a missing file, the `/api/` reference included (D270, D272).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { AstroIntegration } from 'astro'
import { checkDist } from '../../scripts/checks/dist'

export function buildChecks(diagramsFile: string): AstroIntegration {
  return {
    name: 'mailsink:build-checks',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const counts = JSON.parse(readFileSync(diagramsFile, 'utf8')) as Record<string, number>
        const errors = checkDist({
          dir: fileURLToPath(dir),
          diagrams: new Map(Object.entries(counts)),
        })
        if (errors.length > 0) {
          for (const error of errors) logger.error(error)
          throw new Error(`build checks: ${errors.length} problem(s) in the built site`)
        }
        logger.info(`build checks: ${Object.keys(counts).length} pages with diagrams, links sound`)
      },
    },
  }
}
