import {
  type DeliveryStatus,
  extractLinks,
  findLink,
  type LinkMatcher,
  type MessageContent,
} from '@devitek/mailsink'
import type { MatcherContext, MatcherResult } from './context'

/** A message as `messages.get`, `messages.waitFor` or `messages.list` answer it. */
export interface MessageWithStatus {
  subject?: string
  status: DeliveryStatus
  recipients?: readonly { email: string; status: DeliveryStatus }[]
}

export interface StatusOptions {
  /** Checks the status of this recipient (a `MessageDetail`) instead of the aggregate. */
  recipient?: string
}

const subjectOf = (m: { subject?: string | null }) => (m.subject ? ` "${m.subject}"` : '')

function assertMessage(received: unknown, matcher: string): asserts received is object {
  if (!received || typeof received !== 'object') {
    throw new TypeError(`${matcher} expects a message, got ${String(received)}`)
  }
}

/**
 * `expect(message).toHaveStatus('delivered')`: the aggregate status of a message, or the
 * status of one recipient with `{ recipient }`; several statuses mean any of them.
 */
export function toHaveStatus(
  this: MatcherContext,
  received: unknown,
  expected: DeliveryStatus | readonly DeliveryStatus[],
  options: StatusOptions = {},
): MatcherResult {
  assertMessage(received, 'toHaveStatus')
  const message = received as MessageWithStatus
  const allowed: readonly string[] = typeof expected === 'string' ? [expected] : expected
  const wanted = allowed.join(' or ')
  let actual: string | undefined = message.status
  let who = `message${subjectOf(message)}`
  if (options.recipient) {
    const email = options.recipient.toLowerCase()
    actual = message.recipients?.find((r) => r.email.toLowerCase() === email)?.status
    who = `recipient ${options.recipient} of message${subjectOf(message)}`
    if (!actual) {
      return { pass: false, message: () => `expected ${who} to exist (status ${wanted})` }
    }
  }
  const pass = actual !== undefined && allowed.includes(actual)
  return {
    pass,
    message: () =>
      pass
        ? `expected ${who} not to have status ${wanted}`
        : `expected ${who} to have status ${wanted}, got ${actual}`,
  }
}

const describeMatcher = (matcher: LinkMatcher | undefined) =>
  matcher === undefined
    ? 'a link'
    : typeof matcher === 'function'
      ? 'a link matching the predicate'
      : `a link matching ${String(matcher)}`

/**
 * `expect(message).toHaveLink('/verify')`: the message has a link (server links, HTML
 * `href`s, text URLs) matching a substring, a RegExp or a predicate on the URL; any link
 * when no matcher is given.
 */
export function toHaveLink(
  this: MatcherContext,
  received: unknown,
  matcher?: LinkMatcher,
): MatcherResult {
  assertMessage(received, 'toHaveLink')
  const message = received as MessageContent
  const links = extractLinks(message)
  const found = matcher === undefined ? (links[0] ?? null) : findLink(message, matcher)
  const wanted = describeMatcher(matcher)
  const list = links.length ? `\nLinks:\n${links.map((l) => `  - ${l}`).join('\n')}` : ''
  return {
    pass: found !== null,
    message: () =>
      found !== null
        ? `expected the message${subjectOf(message)} not to have ${wanted}, found ${found}`
        : `expected the message${subjectOf(message)} to have ${wanted}${list || ', it has none'}`,
  }
}
