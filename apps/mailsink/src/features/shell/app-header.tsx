import { Mark, Wordmark } from '@mailsink/ui'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import type { WorkspaceSummary } from '../../server-fns/workspace-types'
import { ThemeToggle } from '../../theme/theme-toggle'
import { WorkspacePicker } from '../workspaces/workspace-picker'
import { type NavCounts, NavTabs } from './nav-tabs'
import { SessionMenu } from './session-menu'

// Application header of the prototype (brand-1, H2a): mark and wordmark, the workspace
// picker and tabs when a workspace is open, then the workspace status (live stream
// indicator), the « Language and session » menu and the theme toggle (B2-4).
export function AppHeader({
  workspace,
  counts,
  status,
}: Readonly<{ workspace?: WorkspaceSummary; counts?: NavCounts; status?: ReactNode }>) {
  return (
    <header className="flex h-header shrink-0 items-center gap-[13px] border-b border-ms-border bg-ms-panel px-4">
      <Link to="/" aria-label="mailsink" className="flex items-center gap-2.5 text-md text-ms-text">
        <Mark size={20} />
        <Wordmark className="max-sm:hidden" />
      </Link>
      {workspace && (
        <>
          <span aria-hidden className="text-ms-text-faint">
            /
          </span>
          <div className="min-w-0">
            <WorkspacePicker key={workspace.slug} workspace={workspace} />
          </div>
          <NavTabs workspaceSlug={workspace.slug} counts={counts} />
        </>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-2.5">
        {status}
        <SessionMenu />
        <ThemeToggle />
      </div>
    </header>
  )
}
