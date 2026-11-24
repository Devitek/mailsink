// Public entry point of @devitek/mailsink-playwright (docs/guides/e2e.md).
export {
  type ExtractCodeOptions,
  extractCode,
  extractLinks,
  findLink,
  isMailsinkError,
  type LinkMatcher,
  type Mailsink,
  MailsinkError,
  type MessageDetail,
  type StreamEvent,
} from '@devitek/mailsink'
export type { EmailFilters, ExpectEmailOptions } from './expect-email'
export { expect, type MailsinkTestFixtures, type MailsinkWorkerFixtures, test } from './fixtures'
export { getCode, getLink, type OpenLinkOptions, openLink, rebaseUrl } from './links'
export {
  type AttachmentMatcher,
  type MatcherResult,
  type MatcherState,
  mailsinkMatchers,
} from './matchers'
export type { MailsinkWorkspaceOptions } from './options'
export { type ResetOptions, resetOverrides, resetWorkspace } from './reset'
export type { MailsinkTestClient } from './session'
export type { MailsinkWorkspace } from './workspace'
