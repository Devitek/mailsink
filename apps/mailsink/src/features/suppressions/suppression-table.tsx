import { Trans, useLingui } from '@lingui/react/macro'
import type { SuppressionReason, SuppressionView } from '@mailsink/contracts'
import { Button, StatusBadge } from '@mailsink/ui'
import { Link } from '@tanstack/react-router'
import { RelativeTime, useNow } from '../inbox/relative-time'

type SuppressionTableProps = {
  slug: string
  rows: SuppressionView[]
  loading: boolean
  /** An address filter is set: the empty state says nothing matches. */
  filtered: boolean
  onRemove: (email: string) => void
}

/** Reasons are technical values shown in the colour of the status that caused them. */
const REASON_STATUS = {
  hard_bounce: 'hard_bounce',
  complained: 'complained',
  manual: 'suppressed',
} as const satisfies Record<SuppressionReason, string>

const cols = 'grid grid-cols-[minmax(0,1fr)_120px_120px_110px_190px] items-center gap-4 px-[19px]'

// Table of the suppression list (#42, prototype « Rétention & suppression »): address,
// reason, the message that caused it, since when, and « Remove from the list ». A plain
// table: the generic DataTable of @mailsink/ui can replace it once merged.
export function SuppressionTable({
  slug,
  rows,
  loading,
  filtered,
  onRemove,
}: SuppressionTableProps) {
  const { t } = useLingui()
  const now = useNow()
  return (
    <div className="overflow-auto rounded-lg border border-ms-border bg-ms-panel">
      <table className="block min-w-[700px]">
        <thead className="block">
          <tr
            className={`${cols} h-[34px] border-b border-ms-border text-label font-medium tracking-[0.06em] text-ms-text-faint uppercase`}
          >
            <th className="text-left font-medium">
              <Trans>Address</Trans>
            </th>
            <th className="text-left font-medium">
              <Trans>Reason</Trans>
            </th>
            <th className="text-left font-medium">
              <Trans>Message</Trans>
            </th>
            <th className="text-left font-medium">
              <Trans>Since</Trans>
            </th>
            <th>
              <span className="sr-only">
                <Trans>Actions</Trans>
              </span>
            </th>
          </tr>
        </thead>
        <tbody className="block">
          {rows.map((row) => (
            <tr
              key={row.id}
              className={`${cols} h-[42px] border-b border-ms-border font-mono text-xs last:border-b-0`}
            >
              <td className="truncate" title={row.email}>
                {row.email}
              </td>
              <td>
                <StatusBadge status={REASON_STATUS[row.reason]}>{row.reason}</StatusBadge>
              </td>
              <td className="truncate text-ms-text-muted">
                {row.messageId ? (
                  <Link
                    to="/w/$workspaceSlug"
                    params={{ workspaceSlug: slug }}
                    search={{ m: row.messageId }}
                    title={row.messageId}
                    className="text-ms-accent-text underline-offset-4 hover:underline"
                  >
                    {/* UUIDv7 ids share their time prefix: the tail tells them apart. */}…
                    {row.messageId.slice(-8)}
                  </Link>
                ) : (
                  <Trans>none</Trans>
                )}
              </td>
              <td className="text-ms-text-faint">
                <RelativeTime iso={row.createdAt} now={now} />
              </td>
              <td className="text-right">
                <Button
                  size="sm"
                  aria-label={t`Remove ${row.email} from the suppression list`}
                  onClick={() => onRemove(row.email)}
                  className="font-sans"
                >
                  <Trans>Remove from the list</Trans>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!loading && rows.length === 0 && (
        <p className="p-[27px] text-center text-sm text-ms-text-faint">
          {filtered ? (
            <Trans>No suppressed address matches this filter.</Trans>
          ) : (
            <Trans>The suppression list is empty.</Trans>
          )}
        </p>
      )}
    </div>
  )
}
