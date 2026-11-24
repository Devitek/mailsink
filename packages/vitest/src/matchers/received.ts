import type { ListMessagesParams, Mailsink, MessageSummary } from '@devitek/mailsink'
import type { MatcherContext, MatcherResult } from './context'

export interface ReceivedEmailOptions {
  /** How long to wait for a matching message, default 5 000 ms. Ignored with `.not`. */
  timeout?: number
  /**
   * Oldest `createdAt` that counts. Default: every message of the workspace, so a message
   * that arrived before the assertion matches too.
   */
  since?: Date | string
}

export const DEFAULT_RECEIVED_TIMEOUT_MS = 5_000

/** What `toHaveReceivedEmail` accepts: an SDK client, or a handle with a `client`. */
export type MailsinkLike = Pick<Mailsink, 'messages'> | { client: Pick<Mailsink, 'messages'> }

function messagesOf(received: unknown): Mailsink['messages'] {
  const value = received as { client?: { messages?: unknown }; messages?: unknown } | null
  const messages = value?.messages ?? value?.client?.messages
  if (!messages || typeof (messages as Mailsink['messages']).waitFor !== 'function') {
    throw new TypeError(
      'toHaveReceivedEmail expects a Mailsink client or a workspace handle with a `client`',
    )
  }
  return messages as Mailsink['messages']
}

const describeFilters = (filters: ListMessagesParams) => {
  const entries = Object.entries(filters).filter(([, v]) => v !== undefined)
  return entries.length ? JSON.stringify(Object.fromEntries(entries)) : 'any filter'
}

const line = (m: MessageSummary) =>
  `  - "${m.subject}" to ${m.to.map((a) => a.email).join(', ')} (${m.status})`

/**
 * `await expect(client).toHaveReceivedEmail(filters?, options?)`: passes when a message of
 * the workspace matches `filters` (the `messages.list` filters: `to`, `subject`, `status`,
 * `tag`, `q`...), waiting up to `timeout`. With `.not`, checks once without waiting.
 */
export async function toHaveReceivedEmail(
  this: MatcherContext,
  received: unknown,
  filters: ListMessagesParams = {},
  options: ReceivedEmailOptions = {},
): Promise<MatcherResult> {
  const messages = messagesOf(received)
  const since = options.since ?? new Date(0)
  const wanted = describeFilters(filters)
  let found: MessageSummary | undefined
  if (this.isNot) {
    found = (await messages.list({ ...filters, since, limit: 1 })).data[0]
  } else {
    const timeout = options.timeout ?? DEFAULT_RECEIVED_TIMEOUT_MS
    try {
      found = await messages.waitFor(filters, { since, timeout })
    } catch (error) {
      if ((error as { code?: unknown })?.code !== 'wait_timeout') throw error
      const recent = (await messages.list({ since, limit: 5 })).data
      const seen = recent.length
        ? `Latest messages of the workspace:\n${recent.map(line).join('\n')}`
        : 'The workspace has no message.'
      return {
        pass: false,
        message: () => `expected an email matching ${wanted} within ${timeout} ms\n${seen}`,
      }
    }
  }
  return found
    ? {
        pass: true,
        message: () => `expected no email matching ${wanted}, found:\n${line(found)}`,
      }
    : { pass: false, message: () => `expected an email matching ${wanted}, found none` }
}
