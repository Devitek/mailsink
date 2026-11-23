import { useLingui } from '@lingui/react/macro'
import type { ApiLogSummary } from '@mailsink/contracts'
import { type DataTableColumn, dataTableColumns } from '@mailsink/ui'
import { useMemo } from 'react'
import type { LogConnection } from '../../server-fns/logs-types'
import { ConnectionCell, LogTime } from './cells'
import { httpTone } from './format'
import { CodeBadge, Duration, TypeBadge } from './log-badges'

const col = dataTableColumns<ApiLogSummary>()

/** Prototype column widths, shared by the three tables. */
export const LOG_WIDTHS = {
  createdAt: '152px',
  type: '96px',
  connection: '150px',
  status: '128px',
  durationMs: '96px',
}

// Columns of the API / providers table: the call, its dialect, its status code and error.
export function useApiColumns(
  connections: readonly LogConnection[] | undefined,
  now: number,
): DataTableColumn<ApiLogSummary>[] {
  const { t } = useLingui()
  return useMemo(
    () => [
      col.accessor('createdAt', {
        header: t`Timestamp`,
        enableSorting: true,
        cell: (c) => <LogTime iso={c.getValue()} now={now} />,
      }),
      col.accessor('dialect', {
        id: 'type',
        header: t`Type`,
        cell: (c) => <TypeBadge kind="api">{c.getValue()}</TypeBadge>,
      }),
      col.accessor('connectionId', {
        id: 'connection',
        header: t`Connection`,
        cell: (c) => <ConnectionCell id={c.getValue()} connections={connections} />,
      }),
      col.accessor('path', {
        id: 'action',
        header: t`Action`,
        cell: ({ row }) => (
          <span title={`${row.original.method} ${row.original.path}`}>
            {row.original.method} {row.original.path}
          </span>
        ),
      }),
      col.accessor('statusCode', {
        id: 'statusCode',
        header: t`Status`,
        enableSorting: true,
        cell: ({ row }) => (
          <CodeBadge tone={httpTone(row.original.statusCode)} title={row.original.errorCode ?? ''}>
            {row.original.statusCode}
            {row.original.errorCode ? ` ${row.original.errorCode}` : ''}
          </CodeBadge>
        ),
      }),
      col.accessor('durationMs', {
        header: t`Duration`,
        enableSorting: true,
        cell: (c) => <Duration ms={c.getValue()} />,
      }),
    ],
    [t, connections, now],
  )
}
