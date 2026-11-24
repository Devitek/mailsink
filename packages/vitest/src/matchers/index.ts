// Framework-agnostic matchers: `expect.extend(mailsinkMatchers)` in Vitest or Jest.
import type { DeliveryStatus, LinkMatcher, ListMessagesParams } from '@devitek/mailsink'
import { type StatusOptions, toHaveLink, toHaveStatus } from './message'
import { type ReceivedEmailOptions, toHaveReceivedEmail } from './received'

export type { MatcherContext, MatcherResult } from './context'
export type { MessageWithStatus, StatusOptions } from './message'
export {
  DEFAULT_RECEIVED_TIMEOUT_MS,
  type MailsinkLike,
  type ReceivedEmailOptions,
} from './received'
export { toHaveLink, toHaveReceivedEmail, toHaveStatus }

export const mailsinkMatchers = { toHaveReceivedEmail, toHaveStatus, toHaveLink }

/**
 * Signatures of the matchers, `R` being the return type of a synchronous assertion. Augment
 * your runner's `Matchers` interface with it (Vitest: done by this package; Jest: see
 * `docs/guides/vitest-jest.md`).
 */
export interface MailsinkMatchers<R> {
  /** A message of the workspace matches `filters`; always `await` it. */
  toHaveReceivedEmail(filters?: ListMessagesParams, options?: ReceivedEmailOptions): Promise<void>
  /** The aggregate status of the message (or of `recipient`) is one of `expected`. */
  toHaveStatus(expected: DeliveryStatus | readonly DeliveryStatus[], options?: StatusOptions): R
  /** The message has a link matching `matcher` (any link when omitted). */
  toHaveLink(matcher?: LinkMatcher): R
}
