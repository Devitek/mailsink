// Every server route of `src/routes` is in the OpenAPI registry or deliberately left out of
// it (UNDOCUMENTED_ROUTES), and every registry entry is served (#124, proposition D232).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROUTES, toOpenApiPath, UNDOCUMENTED_ROUTES } from '@mailsink/openapi'
import { describe, expect, it } from 'vitest'

const ROUTES_DIR = join(import.meta.dirname, '..', 'routes')
const METHODS = /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*:/g

/** `post /emails` for each handler of each route file. */
export function serverRoutes(dir: string): string[] {
  const found: string[] = []
  for (const file of readdirSync(dir).filter((name) => /\.tsx?$/.test(name))) {
    const source = readFileSync(join(dir, file), 'utf8')
    const path = source.match(/createFileRoute\(\s*'([^']+)'\s*\)/)?.[1]
    const handlers = source.split(/\bhandlers\s*:/)[1]
    if (!path || !handlers) continue
    for (const [, method] of handlers.matchAll(METHODS)) {
      found.push(`${method?.toLowerCase()} ${toOpenApiPath(path)}`)
    }
  }
  return found.sort()
}

const key = (route: { method: string; path: string }) => `${route.method} ${route.path}`

describe('OpenAPI route coverage', () => {
  const served = serverRoutes(ROUTES_DIR)
  const documented = ROUTES.map(key)
  const undocumented = UNDOCUMENTED_ROUTES.map(key)

  it('scans the route files', () => {
    expect(served).toContain('post /v1/emails')
    expect(served).toContain('get /w/{workspaceSlug}/m/stream')
  })

  it('documents every server route, or lists why it is left out', () => {
    const missing = served.filter((r) => !documented.includes(r) && !undocumented.includes(r))
    expect(missing).toEqual([])
  })

  it('documents no route the server does not serve', () => {
    expect(documented.filter((route) => !served.includes(route))).toEqual([])
    expect(undocumented.filter((route) => !served.includes(route))).toEqual([])
  })

  it('never documents and excludes the same route', () => {
    expect(documented.filter((route) => undocumented.includes(route))).toEqual([])
  })
})
