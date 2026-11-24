import { test as baseTest } from 'vitest'
import {
  createEphemeralWorkspace,
  type EphemeralWorkspaceOptions,
  type MailsinkWorkspace,
} from './workspace'

/** Options, or a function read when the fixture starts (after `beforeAll` hooks). */
export type MailsinkTestOptions = EphemeralWorkspaceOptions | (() => EphemeralWorkspaceOptions)

const read = (options: MailsinkTestOptions) => (typeof options === 'function' ? options() : options)

async function setUp(
  options: MailsinkTestOptions,
  use: (workspace: MailsinkWorkspace) => Promise<void>,
) {
  const workspace = await createEphemeralWorkspace(read(options))
  try {
    await use(workspace)
  } finally {
    await workspace.dispose()
  }
}

/** A `test` whose `mailsink` fixture is one ephemeral workspace per test file. */
export function fileScopedTest(options: MailsinkTestOptions = {}) {
  return baseTest.extend<{ $file: { mailsink: MailsinkWorkspace } }>({
    // biome-ignore lint/correctness/noEmptyPattern: Vitest reads the fixture dependencies from it.
    mailsink: [async ({}, use) => setUp(options, use), { scope: 'file' }],
  })
}

/**
 * A `test` whose `mailsink` fixture is one ephemeral workspace per worker. Vitest isolates
 * each test file in its own worker by default: set `isolate: false` to share it.
 */
export function workerScopedTest(options: MailsinkTestOptions = {}) {
  return baseTest.extend<{ $worker: { mailsink: MailsinkWorkspace } }>({
    // biome-ignore lint/correctness/noEmptyPattern: Vitest reads the fixture dependencies from it.
    mailsink: [async ({}, use) => setUp(options, use), { scope: 'worker' }],
  })
}

export type MailsinkFileTest = ReturnType<typeof fileScopedTest>
export type MailsinkWorkerTest = ReturnType<typeof workerScopedTest>

/**
 * A `test` with a `mailsink` fixture: an ephemeral workspace (`MailsinkWorkspace`) created
 * the first time a test of the file (or worker) uses it and deleted after the last one.
 */
export function createMailsinkTest(options?: MailsinkTestOptions, scope?: 'file'): MailsinkFileTest
export function createMailsinkTest(
  options: MailsinkTestOptions,
  scope: 'worker',
): MailsinkWorkerTest
export function createMailsinkTest(
  options: MailsinkTestOptions = {},
  scope: 'file' | 'worker' = 'file',
) {
  return scope === 'worker' ? workerScopedTest(options) : fileScopedTest(options)
}

/** `test` with a per-file `mailsink` workspace, configured by `MAILSINK_URL` and `MAILSINK_ADMIN_KEY`. */
export const test = fileScopedTest()
