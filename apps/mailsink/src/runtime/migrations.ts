import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** Folder, next to `.output/server/index.mjs`, where nitro.config.ts copies the migrations. */
export const BUNDLED_MIGRATIONS_DIR = 'migrations'

/**
 * Migrations folder of the production build (#11). Nitro sets `globalThis.__nitro_main__` to
 * the URL of the server entry; nitro.config.ts copies `packages/db/migrations` next to it.
 * Returns undefined outside the build (vite dev, tests): `migrate()` then uses the folder
 * shipped with the `@mailsink/db` sources.
 */
export function bundledMigrationsFolder(
  main: unknown = (globalThis as { __nitro_main__?: unknown }).__nitro_main__,
): string | undefined {
  if (typeof main !== 'string' || !main.startsWith('file:')) return undefined
  const folder = fileURLToPath(new URL(`./${BUNDLED_MIGRATIONS_DIR}`, main))
  return existsSync(`${folder}/meta/_journal.json`) ? folder : undefined
}
