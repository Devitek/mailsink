// Public entry point of @devitek/mailsink-vitest for Vitest (docs/guides/vitest-jest.md).
// Jest users import `@devitek/mailsink-vitest/jest`, which does not load Vitest.
import { inject } from 'vitest'
import './vitest-types'
import { connectWorkspace, type MailsinkWorkspace } from './workspace'

export {
  createMailsinkTest,
  fileScopedTest,
  type MailsinkFileTest,
  type MailsinkTestOptions,
  type MailsinkWorkerTest,
  test,
  workerScopedTest,
} from './fixtures'
export { mailsinkGlobalSetup } from './global-setup'
export * from './matchers'
export * from './workspace'

/**
 * The workspace of `@devitek/mailsink-vitest/global-setup`, as a handle. Its `dispose()`
 * does nothing: the global teardown deletes the workspace.
 */
export function injectMailsink(): MailsinkWorkspace {
  const data = inject('mailsink')
  if (!data) {
    throw new Error(
      'Mailsink: no workspace provided, add @devitek/mailsink-vitest/global-setup to globalSetup',
    )
  }
  return connectWorkspace(data)
}
