import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { bundledMigrationsFolder } from './migrations'

describe('bundledMigrationsFolder', () => {
  it('resolves the folder copied next to the server entry', () => {
    const server = mkdtempSync(join(tmpdir(), 'mailsink-build-'))
    mkdirSync(join(server, 'migrations', 'meta'), { recursive: true })
    writeFileSync(join(server, 'migrations', 'meta', '_journal.json'), '{}')
    const main = pathToFileURL(join(server, 'index.mjs')).href
    expect(bundledMigrationsFolder(main)).toBe(join(server, 'migrations'))
  })

  it('falls back to the package sources outside the build', () => {
    expect(bundledMigrationsFolder(undefined)).toBeUndefined()
    const empty = mkdtempSync(join(tmpdir(), 'mailsink-build-'))
    expect(bundledMigrationsFolder(pathToFileURL(join(empty, 'index.mjs')).href)).toBeUndefined()
  })
})
