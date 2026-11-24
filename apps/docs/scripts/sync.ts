// `pnpm --filter @mailsink/docs sync`: renders the repository Markdown into the Starlight
// content collection (`src/content/docs/`, git-ignored except the landing page), writes the
// landing quick start and the OpenAPI document. Run by `dev`, `build` and `typecheck`.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createOpenApiDocument } from '@mailsink/openapi'
import { rewriteLinks } from './links'
import { firstFence, pickSections, splitTitle, toFrontmatter } from './markdown'
import { PAGES, REPO_URL, type SourcePage } from './pages'

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(app, '../..')
const content = join(app, 'src/content/docs')
const generated = join(app, 'src/generated')

const slugs = new Map(PAGES.map((page) => [page.source, page.slug]))
const isDirectory = (path: string) => {
  try {
    return statSync(join(root, path)).isDirectory()
  } catch {
    return false
  }
}
const exists = (path: string) => existsSync(join(root, path))
const links = (markdown: string, source: string) =>
  rewriteLinks(markdown, { source, slugs, isDirectory, exists, repoUrl: REPO_URL })

function write(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
}

function render(page: SourcePage): string {
  const markdown = readFileSync(join(root, page.source), 'utf8')
  const source = page.sections ? pickSections(markdown, page.sections) : markdown
  const { title, body } = page.sections ? { title: '', body: source } : splitTitle(source)
  const header = toFrontmatter({
    title: page.title ?? title,
    editUrl: `${REPO_URL}/edit/main/${page.source}`,
    sidebar:
      page.label || page.order !== undefined ? { label: page.label, order: page.order } : undefined,
  })
  const notice = `<!-- Generated from ${page.source} by apps/docs/scripts/sync.ts: edit the source. -->`
  return `${header}\n${notice}\n\n${links(body, page.source).trim()}\n`
}

/** Landing partial: the README introduction and the first Compose commands. */
function quickStart(): string {
  const readme = readFileSync(join(root, 'README.md'), 'utf8')
  const intro = pickSections(readme, [''])
    .split(/\n\s*\n/)
    .filter((block) => !block.trimStart().startsWith('<'))
    .join('\n\n')
  const installation = pickSections(readme, ['Installation']).replace(/^## .*\n/, '')
  const head = installation.slice(0, installation.indexOf(firstFence(installation))).trimStart()
  return links(`${intro}\n\n## Quick start\n\n${head}${firstFence(installation)}\n`, 'README.md')
}

// Everything but the committed landing page is generated: start from a clean collection.
for (const entry of readdirSync(content)) {
  if (entry !== 'index.mdx') rmSync(join(content, entry), { force: true, recursive: true })
}
for (const page of PAGES) {
  const nested = PAGES.some((other) => other.slug.startsWith(`${page.slug}/`))
  write(join(content, nested ? `${page.slug}/index.md` : `${page.slug}.md`), render(page))
}
write(join(generated, 'quick-start.md'), quickStart())
// No server URL: the site documents the API of any instance (`http://localhost:3000`).
write(join(generated, 'openapi.json'), `${JSON.stringify(createOpenApiDocument({}), null, 2)}\n`)
console.log(`docs: ${PAGES.length} pages, quick start and openapi.json synced`)
