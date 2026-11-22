import { randomBytes } from 'node:crypto'
import type { PGlite } from '@electric-sql/pglite'
import pg from 'pg'
import { createDb, type DbHandle, type Driver } from '../client'
import { migrate } from '../migrate'

export interface TestDb extends DbHandle {
  /** Closes the handle and drops the throwaway database (Postgres). */
  dispose(): Promise<void>
}

export interface OpenTestDbOptions {
  /** Apply the migrations (default true). */
  migrate?: boolean
}

/** Postgres server used by the tests, unset = Postgres side skipped. */
export const testDatabaseUrl = (): string | undefined => process.env.TEST_DATABASE_URL || undefined

/**
 * Opens an isolated database: a fresh in-memory PGlite, or a dedicated database created on
 * the TEST_DATABASE_URL server (so test files run in parallel without sharing state).
 */
export async function openTestDb(driver: Driver, options: OpenTestDbOptions = {}): Promise<TestDb> {
  const handle = driver === 'pglite' ? await openPglite() : await openPostgres()
  if (options.migrate !== false) await migrate(handle)
  return handle
}

async function openPglite(): Promise<TestDb> {
  const handle = createDb('pglite://memory')
  // Boot the WASM instance inside the setup hook, not in the first test's time budget.
  await (handle.client as PGlite).waitReady
  return { ...handle, dispose: () => handle.close() }
}

async function openPostgres(): Promise<TestDb> {
  const serverUrl = testDatabaseUrl()
  if (!serverUrl) throw new Error('TEST_DATABASE_URL is not set')
  const name = `mailsink_t_${randomBytes(6).toString('hex')}`
  await admin(serverUrl, `create database ${name}`)
  const url = new URL(serverUrl)
  url.pathname = `/${name}`
  const handle = createDb(url.toString(), { maxConnections: 4 })
  return {
    ...handle,
    dispose: async () => {
      await handle.close()
      await admin(serverUrl, `drop database if exists ${name} with (force)`)
    },
  }
}

async function admin(serverUrl: string, statement: string): Promise<void> {
  const client = new pg.Client({ connectionString: serverUrl })
  await client.connect()
  try {
    await client.query(statement)
  } finally {
    await client.end()
  }
}
