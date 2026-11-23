import { Trans } from '@lingui/react/macro'
import { Button } from '@mailsink/ui'
import type { InfiniteData } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { WorkspacePage } from '../../server-fns/workspace-types'
import { WorkspaceRow } from './workspace-row'

// The rows of one picker section, page after page, with « Show more » while the server has
// another page (#104).
export function WorkspaceSectionList({
  label,
  data,
  current,
  onPick,
  empty,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: Readonly<{
  label: string
  data: InfiniteData<WorkspacePage, unknown> | undefined
  current?: string
  onPick?: () => void
  empty: ReactNode
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => unknown
}>) {
  if (!data) {
    return (
      <p className="px-4 py-2 text-body text-ms-text-muted">
        <Trans>Loading workspaces…</Trans>
      </p>
    )
  }
  const rows = data.pages.flatMap((p) => p.data)
  return (
    <nav aria-label={label} className="flex flex-col gap-px px-2 pb-2">
      {rows.map((w) => (
        <WorkspaceRow key={w.id} workspace={w} current={current} onPick={onPick} />
      ))}
      {rows.length === 0 && <p className="px-2.5 py-2 text-body text-ms-text-muted">{empty}</p>}
      {hasNextPage && (
        <Button
          variant="ghost"
          size="sm"
          className="justify-start text-ms-text-muted"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          {isFetchingNextPage ? <Trans>Loading…</Trans> : <Trans>Show more</Trans>}
        </Button>
      )}
    </nav>
  )
}
