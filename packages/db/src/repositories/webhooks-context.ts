import { and, asc, eq } from 'drizzle-orm'
import type { Executor } from '../client'
import { connections } from '../schema/connections'
import { messageRecipients, messages } from '../schema/messages'
import { workspaces } from '../schema/workspaces'

// What a webhook formatter needs to know about a message and its workspace (D21).

export interface WebhookWorkspaceRow {
  id: string
  slug: string
  timezone: string
}

export interface WebhookMessageRow {
  id: string
  workspaceId: string
  connectionId: string | null
  connectionKind: 'resend' | 'brevo' | 'smtp' | null
  source: 'native' | 'resend' | 'brevo' | 'smtp'
  providerMessageId: string
  from: { email: string; name?: string | null }
  to: string[]
  subject: string
  tags: { name: string; value: string }[]
  metadata: Record<string, unknown>
  templateId: number | null
  /** Extracted links (automatic clicks pick one). */
  links: { url: string; text?: string }[]
  createdAt: Date
}

export async function findWebhookWorkspace(
  db: Executor,
  workspaceId: string,
): Promise<WebhookWorkspaceRow | undefined> {
  const [row] = await db
    .select({ id: workspaces.id, slug: workspaces.slug, timezone: workspaces.timezone })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
  return row
}

/** The message (of `workspaceId`) with its connection kind and `to` addresses. */
export async function findWebhookMessage(
  db: Executor,
  workspaceId: string,
  messageId: string,
): Promise<WebhookMessageRow | undefined> {
  const [row] = await db
    .select({ message: messages, connectionKind: connections.kind })
    .from(messages)
    .leftJoin(connections, eq(connections.id, messages.connectionId))
    .where(and(eq(messages.workspaceId, workspaceId), eq(messages.id, messageId)))
  if (!row) return undefined
  const to = await db
    .select({ email: messageRecipients.email })
    .from(messageRecipients)
    .where(and(eq(messageRecipients.messageId, messageId), eq(messageRecipients.kind, 'to')))
    .orderBy(asc(messageRecipients.id))
  const m = row.message
  return {
    id: m.id,
    workspaceId: m.workspaceId,
    connectionId: m.connectionId,
    connectionKind: row.connectionKind,
    source: m.source,
    providerMessageId: m.providerMessageId,
    from: m.from,
    to: to.map((r) => r.email),
    subject: m.subject,
    tags: m.tags,
    metadata: m.metadata ?? {},
    templateId: m.templateRef?.templateId ?? null,
    links: m.links,
    createdAt: m.createdAt,
  }
}
