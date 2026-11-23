import {
  type ExtractCodeOptions,
  extractCode,
  extractLinks,
  findLink,
  type LinkMatcher,
  type MessageContent,
} from '@devitek/mailsink'
import type { Page, Response } from '@playwright/test'

type Described = MessageContent & { id?: string }

/** The first link matching `matcher` (any link when omitted); throws listing the links. */
export function getLink(message: Described, matcher?: LinkMatcher): string {
  const link =
    matcher === undefined ? (extractLinks(message)[0] ?? null) : findLink(message, matcher)
  if (link !== null) return link
  const links = extractLinks(message)
  throw new Error(
    `No link${matcher === undefined ? '' : ` matching ${String(matcher)}`} in ${label(message)}. ` +
      (links.length ? `Links: ${links.join(', ')}` : 'The email has no link.'),
  )
}

/** The one-time code of the email (6 digits by default); throws when there is none. */
export function getCode(message: Described, options?: ExtractCodeOptions): string {
  const code = extractCode(message, options)
  if (code !== null) return code
  const what = options?.pattern
    ? `matching ${String(options.pattern)}`
    : `of ${options?.length ?? 6} digits`
  throw new Error(`No code ${what} in ${label(message)}.`)
}

export interface OpenLinkOptions {
  /** `page.goto` wait condition. Default `load`. */
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit'
  timeout?: number
  /**
   * Replaces the origin of the link, for an application that writes its production URL
   * in emails while the test runs it elsewhere: `rebase: 'http://127.0.0.1:3000'`.
   */
  rebase?: string
}

/**
 * Opens a link of the email in the page (`page.goto`), the way a user clicks it in their
 * mailbox. Resolves the URL opened and the main response.
 */
export async function openLink(
  page: Page,
  message: Described,
  matcher?: LinkMatcher,
  options: OpenLinkOptions = {},
): Promise<{ url: string; response: Response | null }> {
  const { rebase, ...goto } = options
  const url = rebase ? rebaseUrl(getLink(message, matcher), rebase) : getLink(message, matcher)
  const response = await page.goto(url, goto)
  return { url, response }
}

/** `url` with the origin (and base path) of `base`, path, query and hash kept. */
export function rebaseUrl(url: string, base: string): string {
  const source = new URL(url)
  const target = new URL(base)
  const prefix = target.pathname.replace(/\/$/, '')
  return `${target.origin}${prefix}${source.pathname}${source.search}${source.hash}`
}

function label(message: Described): string {
  const subject = message.subject ? ` ${JSON.stringify(message.subject)}` : ''
  return `the email${subject}${message.id ? ` (${message.id})` : ''}`
}
