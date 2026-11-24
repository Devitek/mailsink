import {
  type ActivateOptions,
  isMailsinkError,
  type Mailsink,
  type MessageDetail,
  type OverrideConfig,
  type OverrideState,
} from '@devitek/mailsink'
import { type EmailFilters, type ExpectEmailOptions, expectEmail } from './expect-email'
import type { MailsinkWorkspace } from './workspace'

/** The test-scoped `mailsink` fixture: the SDK client of the worker's workspace, plus helpers. */
export interface MailsinkTestClient extends Mailsink {
  /**
   * Start of the test on the server clock (`now()`): `expectEmail` only sees emails
   * received from then on.
   */
  since: Date
  /** The worker's workspace: ids, connections, `.env` of the application under test. */
  workspace: MailsinkWorkspace
  /**
   * Waits for the first email matching `filters` received since the start of the test
   * (`options.since` to change it) and resolves its full detail.
   */
  expectEmail(filters?: EmailFilters, options?: ExpectEmailOptions): Promise<MessageDetail>
  /**
   * Activates an override for the rest of the test; the fixture resets it when the test
   * ends. With a callback, the override only lasts for the callback.
   */
  withOverride(config: OverrideConfig, options?: ActivateOptions): Promise<OverrideState>
  withOverride<T>(
    config: OverrideConfig,
    fn: () => T | Promise<T>,
    options?: ActivateOptions,
  ): Promise<T>
}

export interface TestSession {
  client: MailsinkTestClient
  /** Resets the overrides activated with `withOverride`; a deleted workspace is fine. */
  teardown(): Promise<void>
}

export function createTestSession(workspace: MailsinkWorkspace, since: Date): TestSession {
  const base = workspace.client
  // Scopes activated during the test: `null` is the workspace-wide scope.
  const scopes = new Set<string | null>()
  function withOverride(
    config: OverrideConfig,
    fnOrOptions?: (() => unknown) | ActivateOptions,
    maybeOptions?: ActivateOptions,
  ): Promise<unknown> {
    if (typeof fnOrOptions === 'function') {
      return base.overrides.with(config, fnOrOptions, maybeOptions)
    }
    const options = fnOrOptions ?? {}
    scopes.add(options.connectionId ?? null)
    return base.overrides.activate(config, options)
  }
  const client: MailsinkTestClient = {
    ...base,
    since,
    workspace,
    expectEmail: (filters = {}, options = {}) =>
      expectEmail(base, filters, { ...options, since: options.since ?? since }),
    withOverride: withOverride as MailsinkTestClient['withOverride'],
  }
  return {
    client,
    async teardown() {
      const pending = [...scopes].map((connectionId) =>
        base.overrides.reset(connectionId === null ? {} : { connectionId }).catch((error) => {
          if (!isMailsinkError(error, 'not_found') && !isMailsinkError(error, 'unauthorized')) {
            throw error
          }
        }),
      )
      scopes.clear()
      await Promise.all(pending)
    },
  }
}
