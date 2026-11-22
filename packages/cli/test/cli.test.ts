import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDb, MIGRATIONS_FOLDER } from '@mailsink/db'
import { sql } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { run } from '../src/index'

function capture() {
  const lines: string[] = []
  return { lines, io: { out: (l: string) => lines.push(l), err: (l: string) => lines.push(l) } }
}

describe('mailsink cli', () => {
  const dirs: string[] = []
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })))
  })

  it('prints the usage with no command', async () => {
    const { lines, io } = capture()
    expect(await run([], {}, io)).toBe(0)
    expect(lines.join('\n')).toMatch(/mailsink migrate/)
  })

  it('fails on an unknown command', async () => {
    const { lines, io } = capture()
    expect(await run(['nope'], {}, io)).toBe(1)
    expect(lines.join('\n')).toMatch(/Unknown command "nope"/)
  })

  it('migrates the database named by --database-url, then DATABASE_URL', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mailsink-cli-'))
    dirs.push(dir)
    const url = `pglite://${dir}`
    const { lines, io } = capture()
    expect(await run(['migrate', '--database-url', url], {}, io)).toBe(0)
    expect(await run(['migrate'], { DATABASE_URL: url }, io)).toBe(0)
    expect(lines.filter((l) => l.startsWith('Migrations applied'))).toHaveLength(2)

    const handle = createDb(url)
    const result = await handle.db.execute<{ n: number }>(
      sql`select count(*)::int as n from drizzle.__drizzle_migrations`,
    )
    await handle.close()
    const journal = JSON.parse(
      await readFile(join(MIGRATIONS_FOLDER, 'meta', '_journal.json'), 'utf8'),
    ) as { entries: unknown[] }
    expect(result.rows[0]?.n).toBe(journal.entries.length)
  }, 60_000)

  it('reports an invalid DATABASE_URL without echoing it', async () => {
    const { lines, io } = capture()
    expect(await run(['migrate'], { DATABASE_URL: 'mysql://root:secret@db' }, io)).toBe(1)
    expect(lines.join('\n')).toMatch(/Invalid DATABASE_URL/)
    expect(lines.join('\n')).not.toMatch(/secret/)
  })
})
