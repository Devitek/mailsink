import { z } from 'zod'
import { ConnectionId, MessageId } from './ids'
import { DeliveryStatus } from './status'

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

/**
 * `/w/$workspaceSlug/connections`: the connection open in the side panel, by id, or `new`
 * for the creation form (#38). Absent: the first connection.
 */
export const ConnectionsSearch = z.object({ connection: z.string().max(64).optional() })
export type ConnectionsSearch = z.infer<typeof ConnectionsSearch>
