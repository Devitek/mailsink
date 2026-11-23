import {
  type DeliveryStatus,
  isMailsinkError,
  type ListMessagesParams,
  type Mailsink,
  type MessageDetail,
  type MessageSummary,
} from '@devitek/mailsink'
import { rememberSource } from './refresh'

/** Filters of `expectEmail`: those of `messages.list`, `status` also as a single value. */
export type EmailFilters = Omit<ListMessagesParams, 'status' | 'since'> & {
  status?: DeliveryStatus | DeliveryStatus[]
}

export interface ExpectEmailOptions {
  /** Total wait in ms. Default 10 000. */
  timeout?: number
  /** Oldest message that counts. Default (fixture): the start of the test. */
  since?: Date | string
  signal?: AbortSignal
}

/** How many messages a timeout lists to explain what arrived instead. */
const RECENT_LIMIT = 10

/**
 * Waits for the first email matching `filters` received since `since`, and resolves its
 * full detail. On timeout, throws an error listing the emails that did arrive.
 */
export async function expectEmail(
  client: Mailsink,
  filters: EmailFilters,
  options: ExpectEmailOptions & { since: Date | string },
): Promise<MessageDetail> {
  const query = toQuery(filters)
  try {
    const message = await client.messages.waitFor(query, options)
    rememberSource(message, () => client.messages.get(message.id))
    return message
  } catch (error) {
    if (!isMailsinkError(error, 'wait_timeout')) throw error
    const recent = await client.messages
      .list({ since: options.since, limit: RECENT_LIMIT })
      .then((page) => page.data)
      .catch(() => null)
    throw new Error(timeoutMessage(query, options, recent), { cause: error })
  }
}

export function toQuery(filters: EmailFilters): ListMessagesParams {
  const { status, ...rest } = filters
  return status === undefined ? rest : { ...rest, status: [status].flat() }
}

export function timeoutMessage(
  filters: ListMessagesParams,
  options: ExpectEmailOptions & { since: Date | string },
  recent: readonly MessageSummary[] | null,
): string {
  const since = options.since instanceof Date ? options.since.toISOString() : options.since
  const lines = [
    `expectEmail: no email matched ${describeFilters(filters)} within ` +
      `${options.timeout ?? 10_000} ms (since ${since}).`,
  ]
  if (recent === null) lines.push('Could not list the emails received meanwhile.')
  else if (recent.length === 0) lines.push('No email was received since then.')
  else {
    lines.push(`Emails received since then (newest first, at most ${RECENT_LIMIT}):`)
    for (const m of recent) lines.push(`  - ${describeSummary(m)}`)
  }
  return lines.join('\n')
}

function describeFilters(filters: ListMessagesParams): string {
  const entries = Object.entries(filters).filter(([, v]) => v !== undefined)
  return entries.length ? JSON.stringify(Object.fromEntries(entries)) : '{}'
}

function describeSummary(m: MessageSummary): string {
  const to = m.to.map((a) => a.email).join(', ')
  return `to ${to || '(none)'}: ${JSON.stringify(m.subject)} [${m.status}] ${m.id}`
}
