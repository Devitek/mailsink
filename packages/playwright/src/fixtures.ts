import type { OverrideConfig } from '@devitek/mailsink'
import { test as base, expect as baseExpect } from '@playwright/test'
import type { EmailFilters, ExpectEmailOptions } from './expect-email'
import { mailsinkMatchers } from './matchers'
import { type MailsinkWorkspaceOptions, resolveWorkspaceOptions } from './options'
import { type ResetOptions, resetWorkspace } from './reset'
import { createTestSession, type MailsinkTestClient } from './session'
import { type MailsinkWorkspace, provisionWorkspace } from './workspace'

export interface MailsinkWorkerFixtures {
  /** Option: how the worker's workspace is created (URL, admin key, connections, TTL). */
  mailsinkOptions: MailsinkWorkspaceOptions
  /** The ephemeral workspace of the worker, deleted when the worker ends. */
  mailsinkWorkspace: MailsinkWorkspace
}

export interface MailsinkTestFixtures {
  /** Option: what is cleared before each test. Default: messages, overrides, suppressions. */
  mailsinkReset: ResetOptions | boolean
  /** Option: an override active for the whole test (`test.use` per file or describe). */
  mailsinkOverride: OverrideConfig | null
  /** SDK client of the workspace, `since` set at the start of the test, plus helpers. */
  mailsink: MailsinkTestClient
  /** `mailsink.expectEmail`: the first email matching the filters since the test started. */
  expectEmail: MailsinkTestClient['expectEmail']
}

/**
 * `@playwright/test`'s `test` with the Mailsink fixtures. Combine it with your own with
 * `mergeTests(test, yourTest)`, or extend it: `test.extend({ ... })`.
 */
export const test = base.extend<MailsinkTestFixtures, MailsinkWorkerFixtures>({
  mailsinkOptions: [{}, { option: true, scope: 'worker' }],
  mailsinkWorkspace: [
    async ({ mailsinkOptions }, use, workerInfo) => {
      const options = resolveWorkspaceOptions(mailsinkOptions, {
        workerIndex: workerInfo.workerIndex,
        env: process.env,
      })
      const workspace = await provisionWorkspace(options)
      try {
        await use(workspace)
      } finally {
        await workspace.dispose()
      }
    },
    { scope: 'worker', box: true },
  ],
  mailsinkReset: [true, { option: true }],
  mailsinkOverride: [null, { option: true }],
  mailsink: [
    async ({ mailsinkWorkspace, mailsinkReset, mailsinkOverride }, use) => {
      await resetWorkspace(mailsinkWorkspace.client, mailsinkReset)
      const session = createTestSession(mailsinkWorkspace, mailsinkWorkspace.client.now())
      const { client } = session
      const expectEmail = client.expectEmail
      // A step per wait, so reports show what each test waited for.
      client.expectEmail = (filters?: EmailFilters, options?: ExpectEmailOptions) =>
        base.step(
          `expectEmail ${JSON.stringify(filters ?? {})}`,
          () => expectEmail(filters, options),
          {
            box: true,
          },
        )
      if (mailsinkOverride) await client.withOverride(mailsinkOverride)
      try {
        await use(client)
      } finally {
        await session.teardown()
      }
    },
    { box: true },
  ],
  expectEmail: async ({ mailsink }, use) => {
    await use(mailsink.expectEmail)
  },
})

/** `@playwright/test`'s `expect` with `toHaveLink`, `toHaveAttachment`, `toHaveStatus`. */
export const expect = baseExpect.extend(mailsinkMatchers)
