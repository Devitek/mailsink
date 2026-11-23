import { and, asc, count, desc, eq, lt, type SQL } from 'drizzle-orm'
import type { Executor } from '../client'
import { webhookAttempts, webhookDeliveries } from '../schema/webhook-deliveries'
import { webhookEndpoints } from '../schema/webhooks'
import type { WebhookEndpoint } from './webhooks'

export type WebhookDelivery = typeof webhookDeliveries.$inferSelect
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert
export type WebhookAttempt = typeof webhookAttempts.$inferSelect
export type NewWebhookAttempt = typeof webhookAttempts.$inferInsert

export async function insertWebhookDeliveries(
  db: Executor,
  rows: NewWebhookDelivery[],
): Promise<WebhookDelivery[]> {
  if (rows.length === 0) return []
  return db.insert(webhookDeliveries).values(rows).returning()
}

export async function findWebhookDelivery(
  db: Executor,
  workspaceId: string,
  id: string,
): Promise<WebhookDelivery | undefined> {
  const [row] = await db
    .select()
    .from(webhookDeliveries)
    .where(and(eq(webhookDeliveries.workspaceId, workspaceId), eq(webhookDeliveries.id, id)))
  return row
}

/** A delivery with its endpoint (the attempt needs its URL and secrets). */
export async function findDeliveryWithEndpoint(
  db: Executor,
  id: string,
): Promise<{ delivery: WebhookDelivery; endpoint: WebhookEndpoint } | undefined> {
  const [row] = await db
    .select({ delivery: webhookDeliveries, endpoint: webhookEndpoints })
    .from(webhookDeliveries)
    .innerJoin(webhookEndpoints, eq(webhookEndpoints.id, webhookDeliveries.endpointId))
    .where(eq(webhookDeliveries.id, id))
  return row
}

export interface DeliveryFilters {
  endpointId?: string
  payloadFormat?: WebhookDelivery['payloadFormat']
  messageId?: string
  status?: WebhookDelivery['status']
}

export interface ListDeliveriesOptions extends DeliveryFilters {
  /** Id of the last row of the previous page (exclusive). */
  after?: string
  /** Rows to skip (page-number pagination); used without `after`. */
  offset?: number
  limit: number
}

function deliveryFilters(workspaceId: string, options: DeliveryFilters): SQL[] {
  const where: SQL[] = [eq(webhookDeliveries.workspaceId, workspaceId)]
  if (options.endpointId) where.push(eq(webhookDeliveries.endpointId, options.endpointId))
  if (options.payloadFormat) where.push(eq(webhookDeliveries.payloadFormat, options.payloadFormat))
  if (options.messageId) where.push(eq(webhookDeliveries.messageId, options.messageId))
  if (options.status) where.push(eq(webhookDeliveries.status, options.status))
  return where
}

/** Newest first: ids are UUIDv7 text (D25), so the last id of a page is the cursor. */
export async function listWebhookDeliveries(
  db: Executor,
  workspaceId: string,
  options: ListDeliveriesOptions,
): Promise<WebhookDelivery[]> {
  const where = deliveryFilters(workspaceId, options)
  if (options.after) where.push(lt(webhookDeliveries.id, options.after))
  return db
    .select()
    .from(webhookDeliveries)
    .where(and(...where))
    .orderBy(desc(webhookDeliveries.id))
    .limit(options.limit)
    .offset(options.offset ?? 0)
}

/** Deliveries matching the filters (the total of the delivery log pager). */
export async function countWebhookDeliveries(
  db: Executor,
  workspaceId: string,
  options: DeliveryFilters,
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(webhookDeliveries)
    .where(and(...deliveryFilters(workspaceId, options)))
  return row?.n ?? 0
}

export async function updateWebhookDelivery(
  db: Executor,
  id: string,
  set: Partial<Omit<NewWebhookDelivery, 'id'>>,
): Promise<WebhookDelivery | undefined> {
  const [row] = await db
    .update(webhookDeliveries)
    .set(set)
    .where(eq(webhookDeliveries.id, id))
    .returning()
  return row
}

export async function insertWebhookAttempt(
  db: Executor,
  row: NewWebhookAttempt,
): Promise<WebhookAttempt> {
  const [inserted] = await db.insert(webhookAttempts).values(row).returning()
  if (!inserted) throw new Error('webhook attempt not inserted')
  return inserted
}

export async function findWebhookAttempt(
  db: Executor,
  id: string,
): Promise<WebhookAttempt | undefined> {
  const [row] = await db.select().from(webhookAttempts).where(eq(webhookAttempts.id, id))
  return row
}

export async function listWebhookAttempts(
  db: Executor,
  deliveryId: string,
): Promise<WebhookAttempt[]> {
  return db
    .select()
    .from(webhookAttempts)
    .where(eq(webhookAttempts.deliveryId, deliveryId))
    .orderBy(asc(webhookAttempts.attemptNo))
}
