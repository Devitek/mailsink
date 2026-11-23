import { useLingui } from '@lingui/react/macro'
import { Popover, PopoverContent, PopoverTrigger } from '@mailsink/ui'
import { useState } from 'react'
import type { WorkspaceSummary } from '../../server-fns/workspace-types'
import { EphemeralBadge } from './ephemeral-badge'
import { WorkspaceSections } from './workspace-sections'

// Header workspace picker of the prototype: the open workspace's slug (plus its ephemeral
// pill) opens a 340 px popover listing the others, searchable and paged (#104). Ephemeral
// ones stay hidden unless the switch reveals them; it starts on when the open workspace is
// itself ephemeral.
export function WorkspacePicker({ workspace }: Readonly<{ workspace: WorkspaceSummary }>) {
  const { t } = useLingui()
  const slug = workspace.slug
  const [open, setOpen] = useState(false)
  const [showEphemeral, setShowEphemeral] = useState(workspace.ephemeral)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={t`Workspace: ${slug}`}
        className="flex h-control-md max-w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-md border border-ms-border bg-ms-raised pr-2.5 pl-3.5 outline-none transition-colors duration-fast ease-ms hover:bg-ms-hover focus-visible:focus-ring aria-expanded:bg-ms-hover"
      >
        <span className="truncate font-mono text-sm">{workspace.slug}</span>
        {workspace.ephemeral && <EphemeralBadge expiresAt={workspace.expiresAt} withLabel />}
        <span aria-hidden className="text-[10px] text-ms-text-faint">
          ▼
        </span>
      </PopoverTrigger>
      <PopoverContent className="max-h-[min(80dvh,640px)] w-[340px] overflow-y-auto">
        {open && (
          <WorkspaceSections
            current={workspace.slug}
            showEphemeral={showEphemeral}
            onShowEphemeralChange={setShowEphemeral}
            onPick={() => setOpen(false)}
          />
        )}
      </PopoverContent>
    </Popover>
  )
}
