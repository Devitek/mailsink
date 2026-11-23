import { Trans, useLingui } from '@lingui/react/macro'
import type { LogsSearch } from '@mailsink/contracts'
import { DataTable, type DataTableNarrow, type DataTableProps } from '@mailsink/ui'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { LogSources } from '../../server-fns/logs-types'
import { useApiColumns } from './api-columns'
import { PagePager, type SetLogsSearch } from './logs-pager'
import { apiLogsQuery, deliveriesQuery, smtpSessionsQuery } from './queries'
import {
  apiQueryOf,
  deliveriesQueryOf,
  smtpQueryOf,
  sortFromSorting,
  sortingOf,
  sortOf,
} from './search-query'
import { useSmtpColumns } from './smtp-columns'
import { PLACEHOLDER_PREFIX } from './use-replay'
import { useWebhookColumns } from './webhook-columns'

// The three DataTables of the logs explorer (#41): one server query per tab (filters, sort
// and page from the URL), rows open the inspector (`?inspect=`).

export interface LogsTableProps {
  slug: string
  search: LogsSearch
  setSearch: SetLogsSearch
  sources: LogSources | undefined
  now: number
}

const WIDTHS = {
  createdAt: '156px',
  type: '104px',
  connection: '150px',
  status: '168px',
  durationMs: '96px',
}

/**
 * Below 768 px: time, action and status only, no sideways scroll. Applied in CSS, so the
 * server render already has the phone layout (D229).
 */
const NARROW: DataTableNarrow = {
  hiddenColumns: ['type', 'connection', 'durationMs'],
  widths: { createdAt: '84px', status: '96px', statusCode: '96px' },
}

function Frame<T extends object>({
  table,
  pager,
}: Readonly<{ table: DataTableProps<T>; pager: ReactNode }>) {
  return (
    <>
      <div className="min-h-0 flex-1 overflow-auto">
        <DataTable {...table} widths={WIDTHS} narrow={NARROW} className="md:min-w-[860px]" />
      </div>
      {pager}
    </>
  )
}

function Empty({ filtered }: Readonly<{ filtered: boolean }>) {
  return (
    <span className="text-body text-ms-text-faint">
      {filtered ? <Trans>No row matches these filters.</Trans> : <Trans>Nothing logged yet.</Trans>}
    </span>
  )
}

const filtered = (s: LogsSearch) =>
  Boolean(
    s.q ||
      s.connectionId ||
      s.dialect ||
      s.code ||
      s.outcome ||
      s.delivery ||
      s.format ||
      s.endpointId ||
      s.messageId ||
      s.since ||
      s.until ||
      s.method ||
      s.errorCode,
  )

export function ApiLogsTable({ slug, search, setSearch, sources, now }: Readonly<LogsTableProps>) {
  const { t } = useLingui()
  const { data, isPlaceholderData } = useQuery(apiLogsQuery(slug, apiQueryOf(search)))
  const columns = useApiColumns(sources?.connections, now)
  return (
    <Frame
      table={{
        label: t`API calls`,
        columns,
        rowLabel: (row) => `${row.method} ${row.path} ${row.statusCode}`,
        data: data?.data ?? [],
        getRowId: (row) => row.id,
        sorting: sortingOf(sortOf(search)),
        onSortingChange: (sorting) => setSearch({ sort: sortFromSorting(sorting) }),
        selectedRowId: search.inspect,
        onRowClick: (row) => setSearch({ inspect: row.id }),
        pending: isPlaceholderData,
        empty: data && <Empty filtered={filtered(search)} />,
      }}
      pager={
        <PagePager
          search={search}
          setSearch={setSearch}
          rows={data?.data.length ?? 0}
          total={data?.total ?? 0}
        />
      }
    />
  )
}

export function SmtpLogsTable({ slug, search, setSearch, sources, now }: Readonly<LogsTableProps>) {
  const { t } = useLingui()
  const { data, isPlaceholderData } = useQuery(smtpSessionsQuery(slug, smtpQueryOf(search)))
  const columns = useSmtpColumns(sources?.connections, now)
  return (
    <Frame
      table={{
        label: t`SMTP sessions`,
        columns,
        rowLabel: (row) => `SMTP ${row.remoteAddress} ${row.outcome}`,
        data: data?.data ?? [],
        getRowId: (row) => row.id,
        sorting: sortingOf(sortOf(search)),
        onSortingChange: (sorting) => setSearch({ sort: sortFromSorting(sorting) }),
        selectedRowId: search.inspect,
        onRowClick: (row) => setSearch({ inspect: row.id }),
        pending: isPlaceholderData,
        empty: data && <Empty filtered={filtered(search)} />,
      }}
      pager={
        <PagePager
          search={search}
          setSearch={setSearch}
          rows={data?.data.length ?? 0}
          total={data?.total ?? 0}
        />
      }
    />
  )
}

export function WebhookLogsTable({
  slug,
  search,
  setSearch,
  sources,
  now,
}: Readonly<LogsTableProps>) {
  const { t } = useLingui()
  const { data, isPlaceholderData } = useQuery(deliveriesQuery(slug, deliveriesQueryOf(search)))
  const columns = useWebhookColumns(sources, now)
  return (
    <Frame
      table={{
        label: t`Webhook deliveries`,
        columns,
        rowLabel: (row) => `${row.dialectEvent} ${row.payloadFormat} ${row.status}`,
        data: data?.data ?? [],
        getRowId: (row) => row.id,
        selectedRowId: search.inspect,
        // The optimistic replay row has no server id yet.
        onRowClick: (row) =>
          !row.id.startsWith(PLACEHOLDER_PREFIX) && setSearch({ inspect: row.id }),
        pending: isPlaceholderData,
        empty: data && <Empty filtered={filtered(search)} />,
      }}
      pager={
        <PagePager
          search={search}
          setSearch={setSearch}
          rows={data?.data.length ?? 0}
          total={data?.total ?? 0}
        />
      }
    />
  )
}
