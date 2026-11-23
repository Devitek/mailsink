import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { Input, Switch } from '@mailsink/ui'
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query'
import { useDeferredValue, useId, useState } from 'react'
import { NewWorkspaceDialog } from './new-workspace-dialog'
import { workspacesQuery } from './queries'
import { WorkspaceSectionList } from './workspace-section-list'

type SectionsProps = {
  /** Slug of the open workspace: checked in the list. */
  current?: string
  showEphemeral: boolean
  onShowEphemeralChange: (show: boolean) => void
  onPick?: () => void
}

// Content of the workspace picker (prototype header popover, and the `/` page): a search
// box, the persistent workspaces, then the switch revealing the ephemeral ones, hidden by
// default, and the « + New workspace » action (#38). Each section is read and paged on its
// own, so CI leftovers never hide a persistent workspace (#104).
export function WorkspaceSections({
  current,
  showEphemeral,
  onShowEphemeralChange,
  onPick,
}: SectionsProps) {
  const { t } = useLingui()
  const labelId = useId()
  const [text, setText] = useState('')
  const q = useDeferredValue(text.trim())
  const persistent = useInfiniteQuery({
    ...workspacesQuery(false, q),
    placeholderData: keepPreviousData,
  })
  const ephemeral = useInfiniteQuery({
    ...workspacesQuery(true, q),
    enabled: showEphemeral,
    placeholderData: keepPreviousData,
  })
  const count = persistent.data?.pages[0]?.ephemeralCount ?? 0
  return (
    <div className="flex flex-col">
      <div className="px-3 pt-3">
        <Input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label={t`Search workspaces`}
          placeholder={t`Search by slug or name…`}
          inputSize="sm"
        />
      </div>
      <h2 className="px-4 pt-3.5 pb-2 text-label font-medium tracking-[0.06em] text-ms-text-faint uppercase">
        <Trans>Persistent workspaces</Trans>
      </h2>
      <WorkspaceSectionList
        label={t`Persistent workspaces`}
        data={persistent.data}
        current={current}
        onPick={onPick}
        empty={
          q ? <Trans>No workspace matches.</Trans> : <Trans>No persistent workspace yet.</Trans>
        }
        hasNextPage={persistent.hasNextPage}
        isFetchingNextPage={persistent.isFetchingNextPage}
        fetchNextPage={persistent.fetchNextPage}
      />
      <div className="flex items-center gap-3 border-t border-ms-border px-4 py-3.5">
        <Switch
          checked={showEphemeral}
          onCheckedChange={onShowEphemeralChange}
          aria-labelledby={labelId}
        />
        <div className="min-w-0 flex-1">
          <div id={labelId} className="text-sm">
            <Trans>Show ephemeral workspaces</Trans>
          </div>
          <div className="text-xs text-ms-text-faint">
            <Plural
              value={count}
              one="# created through the Admin API (CI / E2E)"
              other="# created through the Admin API (CI / E2E)"
            />
          </div>
        </div>
      </div>
      {showEphemeral && (
        <WorkspaceSectionList
          label={t`Ephemeral workspaces`}
          data={ephemeral.data}
          current={current}
          onPick={onPick}
          empty={q ? <Trans>No workspace matches.</Trans> : <Trans>No ephemeral workspace.</Trans>}
          hasNextPage={ephemeral.hasNextPage}
          isFetchingNextPage={ephemeral.isFetchingNextPage}
          fetchNextPage={ephemeral.fetchNextPage}
        />
      )}
      <div className="border-t border-ms-border p-2">
        <NewWorkspaceDialog onDone={onPick} />
      </div>
    </div>
  )
}
