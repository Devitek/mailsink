import { sql } from 'drizzle-orm'
import type { Executor } from '../client'

/**
 * Webhook deliveries older than the effective retention of their endpoint scope: the
 * connection's `retention_seconds` when the endpoint is scoped to a connection that sets
 * one, else the workspace's (D154, proposition). Deliveries still in flight (`pending`,
 * `retrying`) are kept until they finish. Attempts go with their delivery by cascade.
 *
 * Same shape as the message purge (`repositories/retention.ts`): one range scan per
 * endpoint on `deliveries_ws_time_idx`, through a `lateral (… offset 0)` subquery so the
 * planner never falls back to a full scan. Idempotent `DELETE … WHERE`.
 */
export async function purgeExpiredWebhookDeliveries(db: Executor): Promise<number> {
  const result = await db.execute<{ n: number }>(
    sql`with d as (
      delete from webhook_deliveries r
      using webhook_endpoints e
        join workspaces w on w.id = e.workspace_id
        left join connections c on c.id = e.connection_id
        cross join lateral (
          select x.id from webhook_deliveries x
          where x.workspace_id = e.workspace_id and x.endpoint_id = e.id
            and x.status in ('succeeded', 'failed')
            and x.created_at < now() - make_interval(
              secs => coalesce(c.retention_seconds, w.retention_seconds))
          offset 0
        ) expired
      where r.id = expired.id
      returning 1
    ) select count(*)::int as n from d`,
  )
  return Number(result.rows[0]?.n ?? 0)
}
