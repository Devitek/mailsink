// Rewrites the relative links of a repository Markdown file for the site: a link to another
// rendered page becomes its site path, anything else points to the file on GitHub.
import { posix } from 'node:path'

export interface LinkOptions {
  /** Repository path of the file being rewritten, e.g. `docs/guides/e2e.md`. */
  source: string
  /** Repository path of each rendered page to its slug (`''` for the site root). */
  slugs: ReadonlyMap<string, string>
  isDirectory: (repoPath: string) => boolean
  /** When given, a link to a missing repository path throws (the GitHub URL would 404). */
  exists?: (repoPath: string) => boolean
  /** `https://github.com/<owner>/<repo>`. */
  repoUrl: string
}

const ABSOLUTE = /^([a-z][a-z0-9+.-]*:|\/|#)/i
const INLINE = /(!?)\[([^\]]*)\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g
const DEFINITION = /^(\s{0,3}\[[^\]]+\]:\s+)(\S+)(.*)$/

function rewriteTarget(target: string, image: boolean, options: LinkOptions): string {
  if (ABSOLUTE.test(target)) return target
  const [path = '', hash] = target.split('#', 2)
  const suffix = hash === undefined ? '' : `#${hash}`
  const resolved = posix.normalize(posix.join(posix.dirname(options.source), path))
  if (options.exists && !options.exists(resolved)) {
    throw new Error(`${options.source}: broken link to ${resolved}`)
  }
  const slug = options.slugs.get(resolved)
  if (slug !== undefined && !image) return `${slug ? `/${slug}/` : '/'}${suffix}`
  if (image) {
    const raw = options.repoUrl.replace('https://github.com/', 'https://raw.githubusercontent.com/')
    return `${raw}/main/${resolved}`
  }
  const kind = options.isDirectory(resolved) ? 'tree' : 'blob'
  return `${options.repoUrl}/${kind}/main/${resolved}${suffix}`
}

/** Rewrites the inline links of a line, code spans excluded. */
function rewriteLine(line: string, options: LinkOptions): string {
  const definition = DEFINITION.exec(line)
  if (definition) {
    const [, head = '', target = '', tail = ''] = definition
    return `${head}${rewriteTarget(target, false, options)}${tail}`
  }
  // Code spans are masked, so a link inside one stays as is while a link whose text holds
  // one (`[`pkg`](path)`) is still rewritten.
  const spans: string[] = []
  const masked = line.replace(/(`+)[^`]*?\1/g, (span) => `\uE000${spans.push(span) - 1}\uE000`)
  return masked
    .replace(
      INLINE,
      (_, bang: string, text: string, target: string, title: string) =>
        `${bang}[${text}](${rewriteTarget(target, bang === '!', options)}${title})`,
    )
    .replace(/\uE000(\d+)\uE000/g, (_, index: string) => spans[Number(index)] ?? '')
}

export function rewriteLinks(markdown: string, options: LinkOptions): string {
  let fence: string | null = null
  return markdown
    .split('\n')
    .map((line) => {
      const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]
      if (marker && (fence === null || marker.startsWith(fence))) {
        fence = fence === null ? marker : null
        return line
      }
      return fence === null ? rewriteLine(line, options) : line
    })
    .join('\n')
}
