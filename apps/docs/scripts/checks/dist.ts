// Checks of the built site (dist/), run by the `build-checks` integration once Astro has
// written every page: no Mermaid block left as code (D270) and no internal link to a
// missing file, the `/api/` reference included (D272).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'

/** Markers of a code block Expressive Code or Shiki rendered with the `mermaid` language. */
const RAW_MERMAID = /data-language="mermaid"|class="[^"]*\blanguage-mermaid\b/

export function hasRawMermaid(html: string): boolean {
  return RAW_MERMAID.test(html)
}

/** Count of rendered diagrams in a page. */
export function countFigures(html: string): number {
  return html.match(/<figure class="ms-mermaid"/g)?.length ?? 0
}

/** Count of ```mermaid blocks in a Markdown source (the GitHub rendering). */
export function countMermaidBlocks(markdown: string): number {
  return markdown.match(/^\s*(`{3,}|~{3,})mermaid\s*$/gm)?.length ?? 0
}

/** Root-relative `href` and `src` targets of a page, hash and query dropped, deduplicated. */
export function internalTargets(html: string): string[] {
  const targets = new Set<string>()
  for (const match of html.matchAll(/\s(?:href|src)="(\/(?!\/)[^"#?]*)/g)) {
    if (match[1]) targets.add(match[1])
  }
  return [...targets]
}

/** The dist file a root-relative target is served from, or undefined when none exists. */
export function resolveTarget(
  target: string,
  exists: (path: string) => boolean,
): string | undefined {
  const path = decodeURIComponent(target).replace(/^\//, '')
  const candidates =
    path === '' || path.endsWith('/') ? [`${path}index.html`] : [path, `${path}/index.html`]
  return candidates.find(exists)
}

export function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.html'))
    .map((file) => file.split(sep).join('/'))
    .sort()
}

export interface DistCheckOptions {
  dir: string
  /** Site path (`architecture/sequence`) to the count of diagrams its source holds. */
  diagrams: ReadonlyMap<string, number>
  /** Prefixes generated after the pages (Pagefind index). */
  ignore?: readonly string[]
}

/** Every problem found in the built site; empty when it is sound. */
export function checkDist({ dir, diagrams, ignore = ['/pagefind/'] }: DistCheckOptions): string[] {
  const errors: string[] = []
  const exists = (path: string) => {
    try {
      return statSync(join(dir, path)).isFile()
    } catch {
      return false
    }
  }
  const pages = htmlFiles(dir)
  for (const page of pages) {
    const html = readFileSync(join(dir, page), 'utf8')
    if (hasRawMermaid(html)) errors.push(`${page}: mermaid block left as code`)
    for (const target of internalTargets(html)) {
      if (ignore.some((prefix) => target.startsWith(prefix))) continue
      if (!resolveTarget(target, exists)) errors.push(`${page}: broken link to ${target}`)
    }
  }
  for (const [slug, expected] of diagrams) {
    const page = `${slug}/index.html`
    const html = exists(page) ? readFileSync(join(dir, page), 'utf8') : ''
    const found = countFigures(html)
    if (found !== expected)
      errors.push(`${page}: ${found} rendered diagrams, ${expected} in the source`)
  }
  return errors
}
