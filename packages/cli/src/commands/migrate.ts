import { createDb, DEFAULT_DATABASE_URL, migrate } from '@mailsink/db'
import { bundledMigrationsFolder } from '../migrations-folder'
import type { Io } from '../output'

export interface MigrateCommandOptions {
  databaseUrl?: string
}

export async function migrateCommand(options: MigrateCommandOptions, io: Io): Promise<void> {
  const handle = createDb(options.databaseUrl || DEFAULT_DATABASE_URL)
  try {
    await migrate(handle, { migrationsFolder: bundledMigrationsFolder() })
    io.out(`Migrations applied (${handle.driver}).`)
  } finally {
    await handle.close()
  }
}
