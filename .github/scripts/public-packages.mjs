#!/usr/bin/env node
// Lists the workspace packages published to npm: every `packages/*` whose package.json is
// not private and is named `@devitek/*` (D255). One line per package, `name dir version`,
// in publish order: a package that depends on another published one comes after it.
// Used by the CI pack check (ci.yml) and the npm release (release-npm.yml), so a new
// public package joins both without editing the workflows.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../../', import.meta.url).pathname
const SCOPE = '@devitek/'

const packages = readdirSync(join(root, 'packages'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((entry) => {
    const dir = join('packages', entry.name)
    try {
      return [{ dir, manifest: JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8')) }]
    } catch {
      return []
    }
  })
  .filter(({ manifest }) => manifest.private !== true && manifest.name?.startsWith(SCOPE))

const published = new Set(packages.map(({ manifest }) => manifest.name))
const internalDeps = ({ manifest }) =>
  ['dependencies', 'peerDependencies', 'optionalDependencies']
    .flatMap((field) => Object.keys(manifest[field] ?? {}))
    .filter((name) => published.has(name) && name !== manifest.name)

// Topological order (dependencies first), stable by name otherwise.
const ordered = []
const visit = (pkg, trail = []) => {
  if (ordered.includes(pkg)) return
  if (trail.includes(pkg)) throw new Error(`dependency cycle: ${pkg.manifest.name}`)
  for (const dep of internalDeps(pkg))
    visit(
      packages.find((p) => p.manifest.name === dep),
      [...trail, pkg],
    )
  ordered.push(pkg)
}
for (const pkg of packages.sort((a, b) => a.manifest.name.localeCompare(b.manifest.name)))
  visit(pkg)

for (const { dir, manifest } of ordered) console.log(`${manifest.name} ${dir} ${manifest.version}`)
