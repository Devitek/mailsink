import { and, arrayContains, between, count, eq, inArray, or, type SQL } from 'drizzle-orm'
import type { Executor } from '../client'
import { apiLogs } from '../schema/logs'
import {
  containsInsensitive,
  type LogPage,
  type LogTimeRange,
  offsetOf,
  orderBy,
  timeRange,
} from './logs-query'

export type ApiLog = typeof apiLogs.$inferSelect
export type NewApiLog = typeof apiLogs.$inferInsert
export type ApiLogDialect = ApiLog['dialect']

export async function insertApiLog(db: Executor, row: NewApiLog): Promise<ApiLog> {
  const [inserted] = await db.insert(apiLogs).values(row).returning()
  if (!inserted) throw new Error('api log not inserted')
  return inserted
}

export interface ApiLogFilters extends LogTimeRange, LogPage {
  connectionId?: string
  dialects?: readonly ApiLogDialect[]
  /** Exact codes (`404`) or classes (`4xx`), any of them matches. */
  statuses?: readonly string[]
  errorCode?: string
  method?: string
  /** Case-insensitive substring of the path. */
  path?: string
  messageId?: string
  /** `createdAt`, `durationMs`, `statusCode`, `-` prefix for descending. */
  sort: string
}

function statusCondition(statuses: readonly string[]): SQL | undefined {
  return or(
    ...statuses.map((s) => {
      if (!s.endsWith('xx')) return eq(apiLogs.statusCode, Number(s))
      const base = Number(s[0]) * 100
      return between(apiLogs.statusCode, base, base + 99)
    }),
  )
}

function where(workspaceId: string, f: ApiLogFilters): SQL | undefined {
  const all: (SQL | undefined)[] = [eq(apiLogs.workspaceId, workspaceId)]
  if (f.connectionId) all.push(eq(apiLogs.connectionId, f.connectionId))
  if (f.dialects?.length) all.push(inArray(apiLogs.dialect, [...f.dialects]))
  if (f.statuses?.length) all.push(statusCondition(f.statuses))
  if (f.errorCode) all.push(eq(apiLogs.errorCode, f.errorCode))
  if (f.method) all.push(eq(apiLogs.method, f.method))
  if (f.path) all.push(containsInsensitive(apiLogs.path, f.path))
  if (f.messageId) all.push(arrayContains(apiLogs.messageIds, [f.messageId]))
  all.push(...timeRange(apiLogs.createdAt, f))
  return and(...all)
}

const SORT_COLUMNS = {
  createdAt: apiLogs.createdAt,
  durationMs: apiLogs.durationMs,
  statusCode: apiLogs.statusCode,
}

/** One page of a workspace's API logs and the total matching the filters. */
export async function listApiLogs(
  db: Executor,
  workspaceId: string,
  filters: ApiLogFilters,
): Promise<{ rows: ApiLog[]; total: number }> {
  const condition = where(workspaceId, filters)
  const [rows, [counted]] = await Promise.all([
    db
      .select()
      .from(apiLogs)
      .where(condition)
      .orderBy(...orderBy(filters.sort, SORT_COLUMNS, apiLogs.id))
      .limit(filters.pageSize)
      .offset(offsetOf(filters)),
    db.select({ n: count() }).from(apiLogs).where(condition),
  ])
  return { rows, total: counted?.n ?? 0 }
}

export async function findApiLog(
  db: Executor,
  workspaceId: string,
  id: string,
): Promise<ApiLog | undefined> {
  const [row] = await db
    .select()
    .from(apiLogs)
    .where(and(eq(apiLogs.workspaceId, workspaceId), eq(apiLogs.id, id)))
  return row
}
