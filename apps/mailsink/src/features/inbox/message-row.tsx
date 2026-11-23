import { useLingui } from '@lingui/react/macro'
import type { InboxRow } from '@mailsink/core'
import { cn, StatusBadge, statusColorVar } from '@mailsink/ui'
import { Link } from '@tanstack/react-router'
import type { ConnectionInfo } from './connection-label'
import { RelativeTime } from './relative-time'

/** Row height of the prototype list (padding, four lines, badges); measured at render. */
export const ROW_HEIGHT = 117

const recipientsOf = (row: InboxRow) => row.to.map((a) => a.email).join(', ')

// One inbox row of the prototype: status dot, recipients and relative time, subject,
// preview, then the status badge, the connection and the sender.
export function MessageRow({
  slug,
  row,
  selected,
  connection,
  now,
}: Readonly<{
  slug: string
  row: InboxRow
  selected: boolean
  connection: ConnectionInfo
  now: number
}>) {
  const { t } = useLingui()
  const subject = row.subject || t`(no subject)`
  return (
    <Link
      to="/w/$workspaceSlug"
      params={{ workspaceSlug: slug }}
      search={(prev) => ({ ...prev, m: row.id, tab: undefined })}
      aria-current={selected ? 'true' : undefined}
      aria-label={subject}
      className={cn(
        'flex w-full gap-[13px] border-b border-l-2 border-b-ms-border py-[15px] pr-4 pl-3.5 text-left outline-none transition-colors duration-fast ease-ms hover:bg-ms-hover focus-visible:bg-ms-hover',
        selected ? 'border-l-ms-accent-text bg-ms-hover' : 'border-l-transparent',
      )}
    >
      <span
        aria-hidden
        className="mt-[5px] size-2 shrink-0 rounded-full"
        style={{ background: statusColorVar(row.status) }}
      />
      <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="flex items-baseline gap-2.5">
          <span className="min-w-0 flex-1 truncate text-sm text-ms-text-muted">
            {recipientsOf(row)}
          </span>
          <span className="shrink-0 font-mono text-label text-ms-text-faint">
            <RelativeTime iso={row.createdAt} now={now} />
          </span>
        </span>
        <span className="truncate font-medium">{subject}</span>
        <span className="min-h-[18px] truncate text-xs text-ms-text-faint">{row.preview}</span>
        <span className="mt-[3px] flex min-w-0 items-center gap-1.5">
          <StatusBadge status={row.status} />
          <span
            title={connection.name ?? undefined}
            className={cn(
              'inline-flex h-[18px] shrink-0 items-center rounded-xs border border-ms-border-strong px-2 text-badge font-medium',
              connection.className,
            )}
          >
            {connection.label}
          </span>
          <span className="min-w-0 truncate text-label text-ms-text-faint">{row.from.email}</span>
        </span>
      </span>
    </Link>
  )
}
