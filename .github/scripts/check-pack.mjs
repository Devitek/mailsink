#!/usr/bin/env node
// Checks packed tarballs before they reach npm (`node check-pack.mjs a.tgz b.tgz`): every
// entry point of package.json (exports, main, types, bin) is in the tarball, no
// `workspace:` specifier is left, README and LICENSE are shipped, nothing private leaks.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const DEP_FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies', 'devDependencies']

/** Every string leaf of an `exports` map (conditions and subpaths), `null` targets skipped. */
const targets = (value) =>
  typeof value === 'string'
    ? [value]
    : value && typeof value === 'object'
      ? Object.values(value).flatMap(targets)
      : []

function check(tarball) {
  const dir = mkdtempSync(join(tmpdir(), 'mailsink-pack-'))
  try {
    execFileSync('tar', ['-xzf', tarball, '-C', dir])
    const root = join(dir, 'package')
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    const problems = []
    const bin =
      typeof manifest.bin === 'string' ? [manifest.bin] : Object.values(manifest.bin ?? {})
    const entries = [
      ...targets(manifest.exports),
      ...[manifest.main, manifest.module, manifest.types, manifest.typings].filter(Boolean),
      ...bin,
    ]
    for (const entry of entries.filter((e) => !e.includes('*')))
      if (!existsSync(join(root, entry))) problems.push(`missing entry point ${entry}`)
    for (const entry of entries.filter((e) => /\.tsx?$/.test(e) && !/\.d\.[cm]?ts$/.test(e)))
      problems.push(`entry point ${entry} is TypeScript source`)
    for (const field of DEP_FIELDS)
      for (const [name, range] of Object.entries(manifest[field] ?? {}))
        if (String(range).startsWith('workspace:')) problems.push(`${field}.${name} is ${range}`)
    for (const [name, range] of Object.entries(manifest.dependencies ?? {}))
      if (name.startsWith('@mailsink/')) problems.push(`depends on private ${name}@${range}`)
    for (const file of ['README.md', 'LICENSE'])
      if (!existsSync(join(root, file))) problems.push(`no ${file}`)
    if (manifest.private) problems.push('private: true')
    if (manifest.publishConfig?.access !== 'public')
      problems.push('publishConfig.access is not public')
    if (manifest.license !== 'MIT') problems.push(`license is ${manifest.license}`)
    if (manifest.repository?.url !== 'git+https://github.com/Devitek/mailsink.git')
      problems.push('repository.url does not match the GitHub repository (trusted publishing)')
    const size = Math.round(statSync(tarball).size / 1024)
    console.log(
      `${manifest.name}@${manifest.version}: ${size} KiB packed, ${entries.length} entry points`,
    )
    for (const problem of problems) console.error(`  - ${problem}`)
    return problems.length === 0
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const tarballs = process.argv.slice(2)
if (tarballs.length === 0) {
  console.error('usage: check-pack.mjs <tarball>...')
  process.exit(2)
}
const results = tarballs.map(check)
if (results.includes(false)) process.exit(1)
