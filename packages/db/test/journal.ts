import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MIGRATIONS_FOLDER } from '../src/migrate'

interface JournalEntry {
  idx: number
  when: number
  tag: string
}

interface Journal {
  entries: JournalEntry[]
}

async function readJournal(folder = MIGRATIONS_FOLDER): Promise<Journal> {
  return JSON.parse(await readFile(join(folder, 'meta', '_journal.json'), 'utf8')) as Journal
}

/** Migrations shipped in packages/db/migrations, in journal order. */
export async function journalEntries(): Promise<JournalEntry[]> {
  return (await readJournal()).entries
}

/**
 * Copies the migrations folder into a temp dir, truncated after `tag`, so a test can build
 * a database as an older release left it, then upgrade it with the real folder.
 */
export async function migrationsUpTo(
  tag: string,
): Promise<{ folder: string; dispose(): Promise<void> }> {
  const folder = await mkdtemp(join(tmpdir(), 'mailsink-migrations-'))
  await cp(MIGRATIONS_FOLDER, folder, { recursive: true })
  const journal = await readJournal(folder)
  const end = journal.entries.findIndex((e) => e.tag === tag)
  if (end < 0) throw new Error(`unknown migration ${tag}`)
  journal.entries = journal.entries.slice(0, end + 1)
  await writeFile(join(folder, 'meta', '_journal.json'), JSON.stringify(journal))
  return { folder, dispose: () => rm(folder, { recursive: true, force: true }) }
}
