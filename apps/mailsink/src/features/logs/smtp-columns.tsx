import { useLingui } from '@lingui/react/macro'
import type { SmtpSessionSummary } from '@mailsink/contracts'
import { type DataTableColumn, dataTableColumns } from '@mailsink/ui'
import { useMemo } from 'react'
import type { LogConnection } from '../../server-fns/logs-types'
import { ConnectionCell, LogTime } from './cells'
import { SMTP_TONE, sessionDurationMs } from './format'
import { CodeBadge, Duration, TypeBadge } from './log-badges'

const col = dataTableColumns<SmtpSessionSummary>()

/** `user@127.0.0.1 · client.host`: who opened the session. */
export function sessionPeer(s: SmtpSessionSummary): string {
  const who = s.authUser ? `${s.authUser}@${s.remoteAddress}` : s.remoteAddress
  return s.clientHostname ? `${who} · ${s.clientHostname}` : who
}

// Columns of the SMTP sessions table: the peer, the outcome and the last error reply.
export function useSmtpColumns(
  connections: readonly LogConnection[] | undefined,
  now: number,
): DataTableColumn<SmtpSessionSummary>[] {
  const { t } = useLingui()
  return useMemo(
    () => [
      col.accessor('startedAt', {
        id: 'createdAt',
        header: t`Timestamp`,
        enableSorting: true,
        cell: (c) => <LogTime iso={c.getValue()} now={now} />,
      }),
      col.accessor('secure', {
        id: 'type',
        header: t`Type`,
        cell: (c) => <TypeBadge kind="smtp">{c.getValue() ? 'SMTP TLS' : 'SMTP'}</TypeBadge>,
      }),
      col.accessor('connectionId', {
        id: 'connection',
        header: t`Connection`,
        cell: (c) => <ConnectionCell id={c.getValue()} connections={connections} />,
      }),
      col.display({
        id: 'action',
        header: t`Session`,
        cell: ({ row }) => {
          const peer = sessionPeer(row.original)
          const count = row.original.messageIds.length
          return (
            <span title={peer}>
              {peer}
              {count > 0 && <span className="text-ms-text-faint"> · {count} msg</span>}
            </span>
          )
        },
      }),
      col.accessor('outcome', {
        id: 'status',
        header: t`Status`,
        cell: ({ row }) => (
          <CodeBadge tone={SMTP_TONE[row.original.outcome]} title={row.original.error ?? ''}>
            {row.original.error?.slice(0, 9) ?? row.original.outcome}
          </CodeBadge>
        ),
      }),
      col.display({
        id: 'durationMs',
        header: t`Duration`,
        cell: ({ row }) => <Duration ms={sessionDurationMs(row.original)} />,
      }),
    ],
    [t, connections, now],
  )
}
