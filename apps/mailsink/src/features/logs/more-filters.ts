import { type LogsSearch, type LogsTab, MessageId } from '@mailsink/contracts'
import { z } from 'zod'

// « More filters » of the logs explorer (#112): the filters the read services support
// beyond the facets (message id on every tab, dates on API and SMTP, method and error code
// on API), typed in a popover form and written to the URL on « Apply ».

export const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

export type MoreFilterValues = {
  messageId: string
  since: string
  until: string
  method: string
  errorCode: string
}

type MoreKey = keyof MoreFilterValues

/** The keys that apply to a tab. */
export function moreKeysOf(tab: LogsTab): MoreKey[] {
  if (tab === 'api') return ['messageId', 'since', 'until', 'method', 'errorCode']
  if (tab === 'smtp') return ['messageId', 'since', 'until']
  return ['messageId']
}

const pad = (n: number) => String(n).padStart(2, '0')

/** ISO instant to the value of a `datetime-local` input, in the browser's time zone. */
export function toLocalInput(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Back from a `datetime-local` value (local time) to an ISO instant; blank stays unset. */
export function fromLocalInput(value: string): string | undefined {
  if (!value) return undefined
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

export function valuesOf(search: LogsSearch): MoreFilterValues {
  return {
    messageId: search.messageId ?? '',
    since: toLocalInput(search.since),
    until: toLocalInput(search.until),
    method: search.method ?? '',
    errorCode: search.errorCode ?? '',
  }
}

/** Active « More filters » of the tab (the trigger count). */
export function activeCount(search: LogsSearch, tab: LogsTab): number {
  return moreKeysOf(tab).filter((key) => search[key] !== undefined).length
}

export function moreFiltersSchema(messages: { messageId: string; range: string }) {
  return z
    .object({
      messageId: z
        .string()
        .trim()
        .refine((v) => v === '' || MessageId.safeParse(v).success, {
          message: messages.messageId,
        }),
      since: z.string(),
      until: z.string(),
      method: z.string(),
      errorCode: z.string(),
    })
    .refine((v) => !v.since || !v.until || Date.parse(v.since) <= Date.parse(v.until), {
      message: messages.range,
      path: ['until'],
    })
}

/** The URL change of « Apply »: every key of the tab, blank ones removed. */
export function changeOf(values: MoreFilterValues, tab: LogsTab): Partial<LogsSearch> {
  const all: Partial<LogsSearch> = {
    messageId: values.messageId.trim() || undefined,
    since: fromLocalInput(values.since),
    until: fromLocalInput(values.until),
    method: values.method || undefined,
    errorCode: values.errorCode.trim().toLowerCase() || undefined,
  }
  return Object.fromEntries(moreKeysOf(tab).map((key) => [key, all[key]]))
}
