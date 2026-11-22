import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * The built bin ships the SQL migrations in `dist/migrations` (copied by tsdown), next to
 * the bundle. From sources this folder does not exist and @mailsink/db uses its own.
 */
export function bundledMigrationsFolder(): string | undefined {
  const folder = fileURLToPath(new URL('./migrations', import.meta.url))
  return existsSync(folder) ? folder : undefined
}
