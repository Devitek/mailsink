import { WAIT_TIMEOUT_MAX_MS } from '@mailsink/contracts'
import { isMailsinkError, MailsinkError } from '../errors'
import type { Transport } from '../http'
import type { QueryValue } from '../query'
import type { ListMessagesParams, MessageDetail, MessagePage } from '../types'

export interface WaitForOptions {
  /** Total wait in ms, default 10 000. Longer than 30 s is split into several long polls. */
  timeout?: number
  /**
   * Oldest `createdAt` that counts, default: the time `waitFor` is called, read on the
   * server clock as estimated by `mailsink.now()` (the client clock until a first answer).
   * Take it before the action that sends the email (`mailsink.now()`), or a message stored
   * before the wait starts is missed.
   */
  since?: Date | string
  signal?: AbortSignal
}

export const DEFAULT_WAIT_TIMEOUT_MS = 10_000

interface Reader {
  get(id: string): Promise<MessageDetail>
}

/**
 * Long polls `GET /capture/messages?wait=true` until one message matches, then answers the
 * earliest one of the page (the first that arrived) as a full detail.
 */
export async function waitForMessage(
  t: Transport,
  reader: Reader,
  filters: ListMessagesParams,
  options: WaitForOptions,
): Promise<MessageDetail> {
  const since = options.since ?? filters.since ?? t.clock.now()
  const timeout = options.timeout ?? DEFAULT_WAIT_TIMEOUT_MS
  const deadline = Date.now() + timeout
  let last: MailsinkError | undefined
  do {
    const chunk = Math.max(0, Math.min(deadline - Date.now(), WAIT_TIMEOUT_MAX_MS))
    try {
      const page = await t.json<MessagePage>({
        method: 'GET',
        path: '/capture/messages',
        auth: 'workspace',
        query: { ...filters, since, wait: true, timeout: chunk } as Record<string, QueryValue>,
        signal: options.signal,
      })
      const first = page.data.at(-1)
      if (first) return reader.get(first.id)
    } catch (error) {
      if (!isMailsinkError(error, 'wait_timeout')) throw error
      last = error
    }
  } while (Date.now() < deadline)
  throw new MailsinkError({
    code: 'wait_timeout',
    message: `No message matched ${describe(filters)} within ${timeout} ms`,
    status: last?.status ?? 408,
    requestId: last?.requestId,
    details: { filters, since: since instanceof Date ? since.toISOString() : since, timeout },
  })
}

function describe(filters: ListMessagesParams): string {
  const entries = Object.entries(filters).filter(([, v]) => v !== undefined)
  return entries.length ? JSON.stringify(Object.fromEntries(entries)) : 'any message'
}
