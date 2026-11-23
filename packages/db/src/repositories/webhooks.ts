import { and, asc, eq, isNull, or, sql } from 'drizzle-orm'
import type { Executor } from '../client'
import { connections } from '../schema/connections'
import { webhookEndpoints } from '../schema/webhooks'

export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect
export type NewWebhookEndpoint = typeof webhookEndpoints.$inferInsert
export type WebhookEndpointUpdate = Partial<
  Omit<NewWebhookEndpoint, 'id' | 'numericId' | 'workspaceId' | 'createdAt'>
>

export async function insertWebhookEndpoint(
  db: Executor,
  row: NewWebhookEndpoint,
): Promise<WebhookEndpoint> {
  const [inserted] = await db.insert(webhookEndpoints).values(row).returning()
  if (!inserted) throw new Error('webhook endpoint not inserted')
  return inserted
}

/** Endpoints of a workspace, oldest first; `connectionId` keeps that scope and Workspace. */
export async function listWebhookEndpoints(
  db: Executor,
  workspaceId: string,
  options: { connectionId?: string } = {},
): Promise<WebhookEndpoint[]> {
  return db
    .select()
    .from(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.workspaceId, workspaceId),
        options.connectionId
          ? or(
              eq(webhookEndpoints.connectionId, options.connectionId),
              isNull(webhookEndpoints.connectionId),
            )
          : undefined,
      ),
    )
    .orderBy(asc(webhookEndpoints.createdAt), asc(webhookEndpoints.id))
}

export async function findWebhookEndpoint(
  db: Executor,
  workspaceId: string,
  id: string,
): Promise<WebhookEndpoint | undefined> {
  const [row] = await db
    .select()
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.workspaceId, workspaceId), eq(webhookEndpoints.id, id)))
  return row
}

export async function updateWebhookEndpoint(
  db: Executor,
  workspaceId: string,
  id: string,
  set: WebhookEndpointUpdate,
): Promise<WebhookEndpoint | undefined> {
  const [row] = await db
    .update(webhookEndpoints)
    .set({ ...set, updatedAt: sql`now()` })
    .where(and(eq(webhookEndpoints.workspaceId, workspaceId), eq(webhookEndpoints.id, id)))
    .returning()
  return row
}

export async function deleteWebhookEndpoint(
  db: Executor,
  workspaceId: string,
  id: string,
): Promise<boolean> {
  const rows = await db
    .delete(webhookEndpoints)
    .where(and(eq(webhookEndpoints.workspaceId, workspaceId), eq(webhookEndpoints.id, id)))
    .returning({ id: webhookEndpoints.id })
  return rows.length > 0
}

/**
 * Enabled endpoints whose scope covers a message of `connectionId` (that connection or
 * the Workspace scope). Subscriptions are filtered by the caller (D24, step 1).
 */
export async function listEndpointsInScope(
  db: Executor,
  workspaceId: string,
  connectionId: string | null,
): Promise<WebhookEndpoint[]> {
  return db
    .select()
    .from(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.workspaceId, workspaceId),
        eq(webhookEndpoints.enabled, true),
        connectionId
          ? or(
              eq(webhookEndpoints.connectionId, connectionId),
              isNull(webhookEndpoints.connectionId),
            )
          : isNull(webhookEndpoints.connectionId),
      ),
    )
    .orderBy(asc(webhookEndpoints.id))
}

/** Whether the workspace has any enabled endpoint (fan-out fast path). */
export async function hasEnabledWebhookEndpoints(
  db: Executor,
  workspaceId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: webhookEndpoints.id })
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.workspaceId, workspaceId), eq(webhookEndpoints.enabled, true)))
    .limit(1)
  return row !== undefined
}

/** Kind of a connection of the workspace, undefined when it is not one of its own. */
export async function findConnectionKind(
  db: Executor,
  workspaceId: string,
  connectionId: string,
): Promise<{ id: string; kind: 'resend' | 'brevo' | 'smtp' } | undefined> {
  const [row] = await db
    .select({ id: connections.id, kind: connections.kind })
    .from(connections)
    .where(and(eq(connections.workspaceId, workspaceId), eq(connections.id, connectionId)))
  return row
}
