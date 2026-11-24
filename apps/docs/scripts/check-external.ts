// `pnpm --filter @mailsink/docs check:external [--strict]`, after `build`: checks the
// external links of dist/ (scripts/checks/external.ts, D272). Fails on a broken link (404,
// 410); an unreachable one (refusal, server or network error) only fails with --strict.
// Successes are cached a week in .cache/external-links.json (kept between CI runs).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { htmlFiles } from './checks/dist'
import { checkUrls, externalUrls, isSkipped, type LinkCache } from './checks/external'

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(app, 'dist')
const cacheFile = join(app, '.cache/external-links.json')
const strict = process.argv.includes('--strict')

if (!existsSync(dist))
  throw new Error('dist/ not found: run `pnpm --filter @mailsink/docs build` first')

// The first page each URL appears on, for the report.
const pages = new Map<string, string>()
for (const page of htmlFiles(dist)) {
  for (const url of externalUrls(readFileSync(join(dist, page), 'utf8'))) {
    if (!isSkipped(url) && !pages.has(url)) pages.set(url, page)
  }
}

const cache: LinkCache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {}
const results = await checkUrls([...pages.keys()], { fetcher: fetch, cache, now: Date.now() })
mkdirSync(dirname(cacheFile), { recursive: true })
writeFileSync(cacheFile, `${JSON.stringify(cache, null, 2)}\n`)

let broken = 0
let unreachable = 0
for (const [url, outcome] of results) {
  if (outcome === 'broken') {
    broken++
    console.error(`broken: ${url} (${pages.get(url)})`)
  } else if (outcome === 'unreachable') {
    unreachable++
    console.warn(`unreachable: ${url} (${pages.get(url)})`)
  }
}
console.log(`external links: ${results.size} checked, ${broken} broken, ${unreachable} unreachable`)
if (broken > 0 || (strict && unreachable > 0)) process.exitCode = 1
