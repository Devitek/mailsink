export const DEFAULT_DATABASE_URL = 'pglite://./data'

export type DatabaseTarget =
  | { driver: 'postgres'; connectionString: string }
  /** `dataDir` undefined = in-memory PGlite. */
  | { driver: 'pglite'; dataDir: string | undefined }

const PGLITE = 'pglite://'

/** Parses `DATABASE_URL`: `postgres://…`, `postgresql://…`, `pglite://<dir>`, `pglite://memory`. */
export function parseDatabaseUrl(url: string): DatabaseTarget {
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    return { driver: 'postgres', connectionString: url }
  }
  if (url.startsWith(PGLITE)) {
    const path = url.slice(PGLITE.length)
    if (path === 'memory') return { driver: 'pglite', dataDir: undefined }
    if (path.length > 0) return { driver: 'pglite', dataDir: path }
  }
  // Only the scheme is echoed: the rest may hold credentials.
  const scheme = url.includes('://') ? `${url.split('://')[0]}://` : 'no scheme'
  throw new Error(
    `Invalid DATABASE_URL (${scheme}): expected postgres://…, pglite://<dir> or pglite://memory`,
  )
}
