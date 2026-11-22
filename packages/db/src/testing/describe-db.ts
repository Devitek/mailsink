import { afterAll, beforeAll, describe } from 'vitest'
import type { Database, Driver } from '../client'
import { type OpenTestDbOptions, openTestDb, type TestDb, testDatabaseUrl } from './test-db'

export interface DbTestContext {
  readonly driver: Driver
  /** Available inside hooks and tests (opened in beforeAll). */
  readonly db: Database
  readonly handle: TestDb
}

const SETUP_TIMEOUT_MS = 60_000

/**
 * Declares the suite once per driver: `[pglite]` always, `[postgres]` when TEST_DATABASE_URL
 * is set (skipped otherwise, so the gap stays visible in the report). Each suite gets its own
 * migrated database.
 */
export function describeDb(
  name: string,
  body: (ctx: DbTestContext) => void,
  options: OpenTestDbOptions = {},
): void {
  for (const driver of ['pglite', 'postgres'] as const) {
    const skip = driver === 'postgres' && !testDatabaseUrl()
    describe.skipIf(skip)(`${name} [${driver}]`, () => {
      let handle: TestDb | undefined
      beforeAll(async () => {
        handle = await openTestDb(driver, options)
      }, SETUP_TIMEOUT_MS)
      afterAll(async () => {
        await handle?.dispose()
      }, SETUP_TIMEOUT_MS)
      const opened = (): TestDb => {
        if (!handle) throw new Error('test database not opened yet')
        return handle
      }
      body({
        driver,
        get db() {
          return opened().db
        },
        get handle() {
          return opened()
        },
      })
    })
  }
}
