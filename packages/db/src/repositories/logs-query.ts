import { asc, desc, gte, ilike, lte, type SQL } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'

// Shared bits of the log repositories (logs-api.ts, logs-smtp.ts).

export interface LogPage {
  /** 1-based page number. */
  page: number
  pageSize: number
}

export interface LogTimeRange {
  since?: Date
  until?: Date
}

export const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&')

export function containsInsensitive(column: PgColumn, value: string): SQL {
  return ilike(column, `%${escapeLike(value)}%`)
}

/** Inclusive bounds on a timestamp column. */
export function timeRange(column: PgColumn, range: LogTimeRange): SQL[] {
  const where: SQL[] = []
  if (range.since) where.push(gte(column, range.since))
  if (range.until) where.push(lte(column, range.until))
  return where
}

/**
 * `field` or `-field` to an ORDER BY on that column, then the id in the same direction so
 * pages never overlap when the sort column has ties.
 */
export function orderBy(sort: string, columns: Record<string, PgColumn>, id: PgColumn): SQL[] {
  const descending = sort.startsWith('-')
  const column = columns[descending ? sort.slice(1) : sort]
  if (!column) throw new Error(`unknown log sort ${sort}`)
  const dir = descending ? desc : asc
  return [dir(column), dir(id)]
}

export const offsetOf = (page: LogPage) => (page.page - 1) * page.pageSize
