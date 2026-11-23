import { Trans, useLingui } from '@lingui/react/macro'
import type { SuppressionReason, SuppressionView } from '@mailsink/contracts'
import type { InboxConnectionFacet } from '@mailsink/core'
import {
  Button,
  DataTable,
  type DataTableColumn,
  dataTableColumns,
  StatusBadge,
} from '@mailsink/ui'
import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { RelativeTime, useNow } from '../inbox/relative-time'

type SuppressionTableProps = {
  slug: string
  rows: SuppressionView[]
  connections: readonly InboxConnectionFacet[] | undefined
  loading: boolean
  /** An address filter is set: the empty state says nothing matches. */
  filtered: boolean
  onRemove: (email: string) => void
  /** Scrolling ancestor: rows beyond a few hundred render only when in view. */
  getScrollElement: () => HTMLElement | null
}

/** Reasons are technical values shown in the colour of the status that caused them. */
const REASON_STATUS = {
  hard_bounce: 'hard_bounce',
  complained: 'complained',
  manual: 'suppressed',
} as const satisfies Record<SuppressionReason, string>

const WIDTHS = {
  reason: '128px',
  connection: '140px',
  message: '120px',
  createdAt: '110px',
  actions: '200px',
}

const col = dataTableColumns<SuppressionView>()

function useColumns(
  slug: string,
  connections: readonly InboxConnectionFacet[] | undefined,
  onRemove: (email: string) => void,
): DataTableColumn<SuppressionView>[] {
  const { t } = useLingui()
  const now = useNow()
  return useMemo(
    () => [
      col.accessor('email', {
        header: t`Address`,
        cell: (c) => <span title={c.getValue()}>{c.getValue()}</span>,
      }),
      col.accessor('reason', {
        header: t`Reason`,
        cell: (c) => (
          <StatusBadge status={REASON_STATUS[c.getValue() as SuppressionReason]}>
            {c.getValue()}
          </StatusBadge>
        ),
      }),
      col.accessor('connectionId', {
        id: 'connection',
        header: t`Connection`,
        cell: (c) => {
          const id = c.getValue()
          const name = id ? (connections?.find((x) => x.id === id)?.name ?? id) : null
          return <span className="text-ms-text-muted">{name ?? '—'}</span>
        },
      }),
      col.accessor('messageId', {
        id: 'message',
        header: t`Message`,
        cell: (c) => {
          const id = c.getValue()
          if (!id) return <span className="text-ms-text-faint">{t`none`}</span>
          return (
            <Link
              to="/w/$workspaceSlug"
              params={{ workspaceSlug: slug }}
              search={{ m: id }}
              title={id}
              className="text-ms-accent-text underline-offset-4 hover:underline"
            >
              {/* UUIDv7 ids share their time prefix: the tail tells them apart. */}…{id.slice(-8)}
            </Link>
          )
        },
      }),
      col.accessor('createdAt', {
        header: t`Since`,
        cell: (c) => (
          <span className="text-ms-text-faint">
            <RelativeTime iso={c.getValue()} now={now} />
          </span>
        ),
      }),
      col.display({
        id: 'actions',
        header: () => <span className="sr-only">{t`Actions`}</span>,
        cell: ({ row }) => (
          <Button
            size="sm"
            aria-label={t`Remove ${row.original.email} from the suppression list`}
            onClick={() => onRemove(row.original.email)}
            className="font-sans"
          >
            <Trans>Remove from the list</Trans>
          </Button>
        ),
      }),
    ],
    [t, now, slug, connections, onRemove],
  )
}

// Table of the suppression list (#42, prototype « Rétention & suppression ») on the generic
// DataTable: address, reason, the connection and message that caused it, since when, and
// « Remove from the list ». Long lists render only the rows in view.
export function SuppressionTable({
  slug,
  rows,
  connections,
  loading,
  filtered,
  onRemove,
  getScrollElement,
}: SuppressionTableProps) {
  const { t } = useLingui()
  const columns = useColumns(slug, connections, onRemove)
  const empty = !loading && (
    <span className="text-sm text-ms-text-faint">
      {filtered ? (
        <Trans>No suppressed address matches this filter.</Trans>
      ) : (
        <Trans>The suppression list is empty.</Trans>
      )}
    </span>
  )
  return (
    <div className="overflow-x-auto rounded-lg border border-ms-border bg-ms-panel">
      <DataTable
        label={t`Suppression list`}
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        widths={WIDTHS}
        rowLabel={(row) => `${row.email} ${row.reason}`}
        empty={empty}
        virtual={{ getScrollElement }}
        className="min-w-[760px]"
      />
    </div>
  )
}
