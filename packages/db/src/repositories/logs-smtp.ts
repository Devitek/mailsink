import { and, arrayContains, count, eq, inArray, or, type SQL } from 'drizzle-orm'
import type { Executor } from '../client'
import { smtpSessions } from '../schema/logs'
import {
  containsInsensitive,
  type LogPage,
  type LogTimeRange,
  offsetOf,
  orderBy,
  timeRange,
} from './logs-query'

export type SmtpSession = typeof smtpSessions.$inferSelect
export type NewSmtpSession = typeof smtpSessions.$inferInsert
export type SmtpSessionOutcome = SmtpSession['outcome']

export async function insertSmtpSession(db: Executor, row: NewSmtpSession): Promise<SmtpSession> {
  const [inserted] = await db.insert(smtpSessions).values(row).returning()
  if (!inserted) throw new Error('smtp session not inserted')
  return inserted
}

export interface SmtpSessionFilters extends LogTimeRange, LogPage {
  connectionId?: string
  outcomes?: readonly SmtpSessionOutcome[]
  /** Case-insensitive substring of the remote address, client hostname or AUTH user. */
  q?: string
  messageId?: string
  /** `startedAt` or `-startedAt`. */
  sort: string
}

function where(workspaceId: string, f: SmtpSessionFilters): SQL | undefined {
  const all: (SQL | undefined)[] = [eq(smtpSessions.workspaceId, workspaceId)]
  if (f.connectionId) all.push(eq(smtpSessions.connectionId, f.connectionId))
  if (f.outcomes?.length) all.push(inArray(smtpSessions.outcome, [...f.outcomes]))
  if (f.q) {
    all.push(
      or(
        containsInsensitive(smtpSessions.remoteAddress, f.q),
        containsInsensitive(smtpSessions.clientHostname, f.q),
        containsInsensitive(smtpSessions.authUser, f.q),
      ),
    )
  }
  if (f.messageId) all.push(arrayContains(smtpSessions.messageIds, [f.messageId]))
  all.push(...timeRange(smtpSessions.startedAt, f))
  return and(...all)
}

/** One page of a workspace's SMTP sessions and the total matching the filters. */
export async function listSmtpSessions(
  db: Executor,
  workspaceId: string,
  filters: SmtpSessionFilters,
): Promise<{ rows: SmtpSession[]; total: number }> {
  const condition = where(workspaceId, filters)
  const [rows, [counted]] = await Promise.all([
    db
      .select()
      .from(smtpSessions)
      .where(condition)
      .orderBy(...orderBy(filters.sort, { startedAt: smtpSessions.startedAt }, smtpSessions.id))
      .limit(filters.pageSize)
      .offset(offsetOf(filters)),
    db.select({ n: count() }).from(smtpSessions).where(condition),
  ])
  return { rows, total: counted?.n ?? 0 }
}

export async function findSmtpSession(
  db: Executor,
  workspaceId: string,
  id: string,
): Promise<SmtpSession | undefined> {
  const [row] = await db
    .select()
    .from(smtpSessions)
    .where(and(eq(smtpSessions.workspaceId, workspaceId), eq(smtpSessions.id, id)))
  return row
}
