import {
  type DeliveryStatus,
  extractLinks,
  findLink,
  type LinkMatcher,
  type MessageDetail,
} from '@devitek/mailsink'
import { sourceOf } from './refresh'

/** The part of Playwright's matcher state these matchers read. */
export interface MatcherState {
  isNot: boolean
  timeout: number
}

export interface MatcherResult {
  pass: boolean
  message: () => string
  name: string
  expected?: unknown
  actual?: unknown
}

export type AttachmentMatcher =
  | string
  | RegExp
  | { filename?: string | RegExp; contentType?: string | RegExp }

type Text = string | RegExp
const matches = (value: string | null, expected: Text) =>
  value !== null && (typeof expected === 'string' ? value === expected : expected.test(value))

const not = (state: MatcherState) => (state.isNot ? 'not ' : '')

/** Poll interval of `toHaveStatus` on a message answered by `expectEmail`. */
const POLL_MS = 200

/**
 * Matchers on a captured email, for `expect.extend` (the package `expect` has them):
 * `toHaveLink`, `toHaveAttachment`, `toHaveStatus`.
 */
export const mailsinkMatchers = {
  /** The email has a link (matching a substring, a RegExp or a predicate on the URL). */
  toHaveLink(this: MatcherState, message: MessageDetail, matcher?: LinkMatcher): MatcherResult {
    const links = extractLinks(message)
    const pass = matcher === undefined ? links.length > 0 : findLink(message, matcher) !== null
    const what = matcher === undefined ? 'a link' : `a link matching ${String(matcher)}`
    return {
      pass,
      name: 'toHaveLink',
      expected: matcher,
      actual: links,
      message: () =>
        `Expected the email ${not(this)}to have ${what}.\nLinks: ${links.join(', ') || '(none)'}`,
    }
  },

  /** The email has an attachment with this file name (or matching name and content type). */
  toHaveAttachment(
    this: MatcherState,
    message: MessageDetail,
    expected: AttachmentMatcher,
  ): MatcherResult {
    const spec =
      typeof expected === 'object' && !(expected instanceof RegExp)
        ? expected
        : {
            filename: expected,
          }
    const pass = message.attachments.some(
      (a) =>
        (spec.filename === undefined || matches(a.filename, spec.filename)) &&
        (spec.contentType === undefined || matches(a.contentType, spec.contentType)),
    )
    const actual = message.attachments.map((a) => `${a.filename ?? '(no name)'} (${a.contentType})`)
    return {
      pass,
      name: 'toHaveAttachment',
      expected,
      actual,
      message: () =>
        `Expected the email ${not(this)}to have an attachment ${describeSpec(spec)}.\n` +
        `Attachments: ${actual.join(', ') || '(none)'}`,
    }
  },

  /**
   * The email (or one recipient) has this delivery status. On an email answered by
   * `expectEmail`, waits for the simulation up to the expect timeout.
   */
  async toHaveStatus(
    this: MatcherState,
    message: MessageDetail,
    expected: DeliveryStatus | DeliveryStatus[],
    options: { recipient?: string; timeout?: number } = {},
  ): Promise<MatcherResult> {
    const wanted = [expected].flat()
    const reload = sourceOf(message)
    const deadline = Date.now() + (options.timeout ?? this.timeout)
    let current = statusOf(message, options.recipient)
    while (reload && wanted.includes(current as DeliveryStatus) === this.isNot) {
      if (Date.now() >= deadline) break
      await new Promise((resolve) => setTimeout(resolve, POLL_MS))
      current = statusOf(await reload(), options.recipient)
    }
    const who = options.recipient ? `recipient ${options.recipient}` : 'email'
    return {
      pass: wanted.includes(current as DeliveryStatus),
      name: 'toHaveStatus',
      expected,
      actual: current,
      message: () =>
        `Expected the ${who} ${not(this)}to have status ${wanted.join(' or ')}.\n` +
        `Received: ${current ?? `(no recipient ${options.recipient})`}`,
    }
  },
}

function statusOf(message: MessageDetail, recipient?: string): DeliveryStatus | null {
  if (recipient === undefined) return message.status
  const email = recipient.toLowerCase()
  return message.recipients.find((r) => r.email.toLowerCase() === email)?.status ?? null
}

function describeSpec(spec: { filename?: Text; contentType?: Text }): string {
  const parts = [
    spec.filename === undefined ? null : `named ${String(spec.filename)}`,
    spec.contentType === undefined ? null : `of type ${String(spec.contentType)}`,
  ]
  return parts.filter(Boolean).join(' ') || '(any)'
}
