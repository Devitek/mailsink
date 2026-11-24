// The `mailsink` fixture: one workspace shared by the tests of a file (or worker). Vitest
// tears file and worker fixtures down after every `afterAll`, when the test server is
// already closed: the suite disposes the captured handle itself first, the fixture's own
// dispose is then a no-op. Fixtures with a file or worker scope must be declared at the top
// level of a test file, not in a `describe`, so `describeDb` cannot run them on both
// drivers: each driver has its own file calling `fixtureSuite` at its top level.
import { isMailsinkError } from '@devitek/mailsink'
import type { Driver } from '@mailsink/db'
import { type DbTestContext, openTestDb, type TestDb } from '@mailsink/db/testing'
import { afterAll, beforeAll, describe, expect } from 'vitest'
import { createMailsinkTest, type MailsinkWorkspace } from '../src'
import '../src/setup'
import { ADMIN_KEY, sendTo, useHarness } from './support'

/** Declares the fixture suite on `driver`; call it at the top level of a test file. */
export function fixtureSuite(driver: Driver): void {
  let db: TestDb | undefined
  beforeAll(async () => {
    db = await openTestDb(driver)
  }, 60_000)
  afterAll(() => db?.dispose())
  const h = useHarness({
    driver,
    get handle() {
      return db
    },
  } as DbTestContext)
  const seen = new Set<MailsinkWorkspace>()
  afterAll(async () => {
    for (const workspace of seen) {
      await workspace.dispose()
      const error = await h.admin.admin.workspaces.get(workspace.workspace.id).catch((e) => e)
      expect(isMailsinkError(error, 'not_found')).toBe(true)
    }
  })

  const options = () => ({ url: h.server.url, adminKey: ADMIN_KEY, workspace: { name: 'Acme' } })
  const fileTest = createMailsinkTest(options)
  const workerTest = createMailsinkTest(options, 'worker')

  describe(`mailsink fixture [${driver}]`, () => {
    fileTest('creates the workspace on first use', async ({ mailsink }) => {
      seen.add(mailsink)
      expect(mailsink.workspace).toMatchObject({ name: 'Acme', ephemeral: true })
      await sendTo(mailsink, { to: 'ada@example.test', subject: 'Welcome to Acme' })
      await expect(mailsink).toHaveReceivedEmail({ to: 'ada@example.test' })
    })

    fileTest('shares it with the other tests of the file', async ({ mailsink }) => {
      seen.add(mailsink)
      expect(seen.size).toBe(1)
      await expect(mailsink).toHaveReceivedEmail({ subject: 'Welcome to Acme' })
    })

    workerTest('worker scope creates its own workspace', async ({ mailsink }) => {
      seen.add(mailsink)
      expect(seen.size).toBe(2)
      await expect(mailsink).not.toHaveReceivedEmail()
    })
  })
}
