import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@mailsink/ui'
import { Link, useLocation } from '@tanstack/react-router'
import { workspacePagePaths } from '../inbox/workspace-pages'

const tab =
  'flex h-full items-center gap-2 border-b-2 px-3.5 font-medium whitespace-nowrap outline-none transition-colors duration-fast ease-ms focus-visible:text-ms-text'
const idle = 'border-transparent text-ms-text-muted hover:text-ms-text'
const current = 'aria-[current=page]:border-ms-accent-text aria-[current=page]:text-ms-text'
const tabClass = `${tab} ${idle} ${current}`

export type NavCounts = { messages?: number; logs?: number }

function Count({ value }: Readonly<{ value: number | undefined }>) {
  if (value === undefined) return null
  return <span className="font-mono text-badge font-medium text-ms-text-faint">{value}</span>
}

// Workspace tabs of the prototype header, with the message and log counts: Messages (the
// inbox), Logs, Settings and Connections. `inline` sits in the header from 768 px; `bar` is
// the row under the header below 768 px, scrolling sideways when the tabs do not fit.
// Logs and Settings stay plain links until their routes exist on main (other Phase 4 lots).
export function NavTabs({
  workspaceSlug,
  counts = {},
  variant = 'inline',
}: Readonly<{ workspaceSlug: string; counts?: NavCounts; variant?: 'inline' | 'bar' }>) {
  const { t } = useLingui()
  const { pathname } = useLocation()
  const page = (path: string) => (pathname.startsWith(path) ? 'page' : undefined)
  const logs = workspacePagePaths.logs(workspaceSlug)
  const settings = workspacePagePaths.settings(workspaceSlug)
  return (
    <nav
      aria-label={t`Workspace`}
      className={cn(
        'flex items-stretch gap-0.5',
        variant === 'inline'
          ? 'ml-1.5 h-full max-md:hidden'
          : 'h-control-xl shrink-0 overflow-x-auto border-b border-ms-border bg-ms-panel px-2 [scrollbar-width:none] md:hidden',
      )}
    >
      <Link
        to="/w/$workspaceSlug"
        params={{ workspaceSlug }}
        activeOptions={{ exact: true, includeSearch: false }}
        className={tabClass}
      >
        <Trans>Messages</Trans>
        <Count value={counts.messages} />
      </Link>
      <a href={logs} aria-current={page(logs)} className={tabClass}>
        <Trans>Logs</Trans>
        <Count value={counts.logs} />
      </a>
      <a href={settings} aria-current={page(settings)} className={tabClass}>
        <Trans>Settings</Trans>
      </a>
      <Link
        to="/w/$workspaceSlug/connections"
        params={{ workspaceSlug }}
        activeOptions={{ includeSearch: false }}
        className={tabClass}
      >
        <Trans>Connections</Trans>
      </Link>
    </nav>
  )
}
