import { PGlite } from '@electric-sql/pglite'
import type { Assume, ExtractTablesWithRelations } from 'drizzle-orm'
import { drizzle as drizzlePostgres } from 'drizzle-orm/node-postgres'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import pg from 'pg'
import * as schema from './schema'
import { DEFAULT_DATABASE_URL, parseDatabaseUrl } from './url'

export type Schema = typeof schema

/** Raw `db.execute()` results: both drivers expose the returned rows as `rows`. */
export interface RowsResult<TRow> {
  rows: TRow[]
}
export interface RowsResultHKT extends PgQueryResultHKT {
  type: RowsResult<Assume<this['row'], Record<string, unknown>>>
}

/** Driver-agnostic Drizzle database: every repository is written against this type. */
export type Database = PgDatabase<RowsResultHKT, Schema, ExtractTablesWithRelations<Schema>>

/** A database or an open transaction on it. */
export type Executor = Database | Parameters<Parameters<Database['transaction']>[0]>[0]

export type Driver = 'postgres' | 'pglite'

export interface DbHandle {
  readonly db: Database
  readonly driver: Driver
  /** Underlying client: a `pg.Pool` (postgres) or a `PGlite` instance. */
  readonly client: pg.Pool | PGlite
  close(): Promise<void>
}

export interface CreateDbOptions {
  /** Pool size for Postgres (default 10). PGlite always has a single connection. */
  maxConnections?: number
  /**
   * Postgres only: an idle pooled client lost its connection (server restart, network).
   * The pool replaces it on next use. Default: a console warning.
   */
  onConnectionError?: (error: Error) => void
}

function warnConnectionLost(error: Error): void {
  console.warn(`[mailsink] database connection lost: ${error.message}`)
}

/** Opens the database named by `DATABASE_URL` (default `pglite://./data`). */
export function createDb(url: string = DEFAULT_DATABASE_URL, options: CreateDbOptions = {}) {
  const target = parseDatabaseUrl(url)
  if (target.driver === 'postgres') {
    const pool = new pg.Pool({
      connectionString: target.connectionString,
      max: options.maxConnections ?? 10,
    })
    // Unhandled, an idle client error on the pool becomes an uncaughtException.
    pool.on('error', options.onConnectionError ?? warnConnectionLost)
    const db = drizzlePostgres({ client: pool, schema })
    return handle(db, 'postgres', pool, () => pool.end())
  }
  const client = new PGlite(target.dataDir)
  const db = drizzlePglite({ client, schema })
  return handle(db, 'pglite', client, () => client.close())
}

function handle(
  db: Database,
  driver: Driver,
  client: pg.Pool | PGlite,
  close: () => Promise<void>,
): DbHandle {
  let closed: Promise<void> | undefined
  return {
    db,
    driver,
    client,
    close: () => {
      closed ??= close()
      return closed
    },
  }
}
