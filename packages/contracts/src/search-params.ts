import { z } from 'zod'
import { ConnectionId, MessageId, WebhookDeliveryId, WebhookEndpointId } from './ids'
import { ApiDialect, ApiLogSort, SmtpOutcome, StatusFilter } from './logs'
import { DeliveryStatus } from './status'
import { PayloadFormat } from './webhook'
import { WebhookDeliveryStatus } from './webhook-delivery'

// Search params of the UI routes (TanStack Router `validateSearch`), validated with Zod.
// The router parses query values as JSON, so `?ephemeral=true` arrives as a boolean.

/** `/`: the workspace picker; ephemeral workspaces are hidden by default (#37). */
export const PickerSearch = z.object({ ephemeral: z.boolean().default(false) })
export type PickerSearch = z.infer<typeof PickerSearch>

/**
 * Free text of a URL: `?q=2026` arrives as a number from the router's JSON parsing. A blank
 * or malformed value is dropped rather than failing the page.
 */
const urlText = z
  .preprocess(
    (v) => (typeof v === 'number' ? String(v) : v),
    z.string().trim().min(1).max(500).optional(),
  )
  .catch(undefined)

/** Tabs of the message viewer (#40). */
export const InboxTab = z.enum(['preview', 'text', 'links', 'headers', 'history'])
export type InboxTab = z.infer<typeof InboxTab>

/**
 * `/w/$workspaceSlug`: the inbox (#39) and its message viewer (#40). Filters live in the
 * URL so a filtered view can be shared and survives a reload; an invalid value is dropped.
 * - `q`: search box (full text, `to:` / `from:` operators, an address searches recipients);
 * - `status`, `connectionId`, `tag` (`name` or `name:value`): facets;
 * - `m`: the open message, `tab`: its viewer tab (preview when absent).
 */
export const InboxSearch = z.object({
  q: urlText,
  status: DeliveryStatus.optional().catch(undefined),
  connectionId: ConnectionId.optional().catch(undefined),
  tag: urlText,
  m: MessageId.optional().catch(undefined),
  tab: InboxTab.optional().catch(undefined),
})
export type InboxSearch = z.infer<typeof InboxSearch>

/** Tabs of the logs explorer (#41). */
export const LogsTab = z.enum(['api', 'smtp', 'webhooks'])
export type LogsTab = z.infer<typeof LogsTab>

/** Sort of the log tables: the API sort keys; `createdAt` is `startedAt` for SMTP. */
export const LogsSort = ApiLogSort
export type LogsSort = z.infer<typeof LogsSort>

/** A facet with several values: an array (router JSON) or comma-separated text. */
const facet = <T extends z.ZodType>(item: T) =>
  z
    .preprocess(
      (v) => (typeof v === 'string' ? v.split(',') : v),
      z.array(item).min(1).max(20).optional(),
    )
    .catch(undefined)

const pageNumber = z.coerce.number().int().min(1).max(100_000).optional().catch(undefined)

/**
 * `/w/$workspaceSlug/logs`: the logs explorer (#41). Every key is optional so links stay
 * short; `features/logs/search-query.ts` resolves the defaults (tab `api`, sort
 * `-createdAt`, page 1, 50 rows). An invalid value is dropped, never an error page.
 * - `q`: API path substring, SMTP address / hostname / AUTH user substring;
 * - `connectionId`: API and SMTP; `dialect`, `code` (HTTP status `404` or class `4xx`): API;
 *   `outcome`: SMTP;
 * - `delivery` (status), `format` (payload format), `endpointId`: webhooks, one value each
 *   (the delivery log filters on one value);
 * - `sort`, `page`, `pageSize`: API and SMTP (page-number pagination with a total);
 * - `cursor`: webhooks (keyset pagination of the delivery log, the last id seen);
 * - `inspect`: the row open in the inspector sheet.
 */
export const LogsSearch = z.object({
  tab: LogsTab.optional().catch(undefined),
  q: urlText,
  connectionId: ConnectionId.optional().catch(undefined),
  dialect: facet(ApiDialect),
  code: facet(StatusFilter),
  outcome: facet(SmtpOutcome),
  delivery: WebhookDeliveryStatus.optional().catch(undefined),
  format: PayloadFormat.optional().catch(undefined),
  endpointId: WebhookEndpointId.optional().catch(undefined),
  sort: LogsSort.optional().catch(undefined),
  page: pageNumber,
  pageSize: z.coerce.number().int().min(10).max(200).optional().catch(undefined),
  cursor: WebhookDeliveryId.optional().catch(undefined),
  inspect: z.string().min(1).max(80).optional().catch(undefined),
})
export type LogsSearch = z.infer<typeof LogsSearch>

/**
 * `/w/$workspaceSlug/connections`: the connection open in the side panel, by id, or `new`
 * for the creation form (#38). Absent: the first connection.
 */
export const ConnectionsSearch = z.object({ connection: z.string().max(64).optional() })
export type ConnectionsSearch = z.infer<typeof ConnectionsSearch>
