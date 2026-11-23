import * as C from '@mailsink/contracts'
import { seg, type Transport } from '../http'
import type { QueryValue } from '../query'
import type {
  ListMessagesParams,
  MessageDetail,
  MessagePage,
  PurgeParams,
  PurgeResult,
  SeedDemoInput,
  SeedDemoResult,
  TriggerEventInput,
  TriggerEventResult,
} from '../types'
import { type WaitForOptions, waitForMessage } from './wait'

export interface Attachment {
  filename: string | null
  contentType: string
  data: Uint8Array
}

/** `/capture/messages`: the captured messages of the workspace. */
export function messagesApi(t: Transport) {
  const path = (id: string, suffix = '') => `/capture/messages/${seg(id)}${suffix}`
  const api = {
    /** One page, newest first. Filters: substrings, `tag`, `status`, `since`, `q`... */
    list: (params: ListMessagesParams = {}, init: { signal?: AbortSignal } = {}) =>
      t.json<MessagePage>({
        method: 'GET',
        path: '/capture/messages',
        auth: 'workspace',
        query: params as Record<string, QueryValue>,
        schema: C.ListMessagesResponse,
        signal: init.signal,
      }),
    /** Full detail: bodies, headers, links, attachments, recipients, events, deliveries. */
    get: (id: string) =>
      t.json<MessageDetail>({
        method: 'GET',
        path: path(id),
        auth: 'workspace',
        schema: C.MessageDetail,
      }),
    /**
     * Resolves the first message matching `filters` created at or after `since` (default:
     * the time of this call, so start it before the action or pass `since`), as a full
     * detail. Throws `MailsinkError` `wait_timeout` when none comes within `timeout`.
     */
    waitFor: (filters: ListMessagesParams = {}, options: WaitForOptions = {}) =>
      waitForMessage(t, api, filters, options),
    /** The raw source (`message/rfc822`) as text. */
    raw: async (id: string) =>
      (await t.send({ method: 'GET', path: path(id, '/raw'), auth: 'workspace' })).text(),
    /** One attachment, as stored. */
    attachment: async (id: string, attachmentId: string): Promise<Attachment> => {
      const response = await t.send({
        method: 'GET',
        path: path(id, `/attachments/${seg(attachmentId)}`),
        auth: 'workspace',
      })
      return {
        filename: filenameOf(response.headers.get('content-disposition')),
        contentType: response.headers.get('content-type') ?? 'application/octet-stream',
        data: new Uint8Array(await response.arrayBuffer()),
      }
    },
    /** Deletes messages (and their logs unless `includeLogs: false`); `{ count }`. */
    purge: (params: PurgeParams = {}) =>
      t.json<PurgeResult>({
        method: 'DELETE',
        path: '/capture/messages',
        auth: 'workspace',
        query: params as Record<string, QueryValue>,
        schema: C.PurgeResponse,
      }),
    /** Forces `opened`, `clicked` or a simulated status (bounce, complaint...). */
    triggerEvent: (id: string, input: TriggerEventInput) =>
      t.json<TriggerEventResult>({
        method: 'POST',
        path: path(id, '/events'),
        auth: 'workspace',
        body: input,
        schema: C.TriggerEventResponse,
      }),
    /** Stores the demo data set (eight messages) through the ingestion pipeline. */
    seedDemo: (input: SeedDemoInput = {}) =>
      t.json<SeedDemoResult>({
        method: 'POST',
        path: '/capture/demo',
        auth: 'workspace',
        body: input,
        schema: C.SeedDemoResponse,
      }),
  }
  return api
}

export type MessagesApi = ReturnType<typeof messagesApi>

/** File name of a `Content-Disposition` header, the RFC 5987 `filename*` first. */
export function filenameOf(disposition: string | null): string | null {
  if (!disposition) return null
  const extended = /filename\*\s*=\s*([\w-]+)''([^;]+)/i.exec(disposition)
  if (extended?.[2]) {
    try {
      return decodeURIComponent(extended[2].trim())
    } catch {
      // fall back to the plain parameter
    }
  }
  const plain = /filename\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^;\s]+))/i.exec(disposition)
  return plain ? (plain[1] ?? plain[2] ?? '').replace(/\\(.)/g, '$1') : null
}
