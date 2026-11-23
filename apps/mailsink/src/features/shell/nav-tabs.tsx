import { Trans, useLingui } from '@lingui/react/macro'
import { Link, useLocation } from '@tanstack/react-router'
import { workspacePagePaths } from '../inbox/workspace-pages'

const tab =
  'flex h-full items-center gap-2 border-b-2 px-3.5 font-medium whitespace-nowrap outline-none transition-colors duration-fast ease-ms focus-visible:text-ms-text'
const idle = 'border-transparent text-ms-text-muted hover:text-ms-text'
const current = 'aria-[current=page]:border-ms-accent-text aria-[current=page]:text-ms-text'

export type NavCounts = { messages?: number; logs?: number }

function Count({ value }: Readonly<{ value: number | undefined }>) {
  if (value === undefined) return null
  return <span className="font-mono text-badge font-medium text-ms-text-faint">{value}</span>
}

// Workspace tabs of the prototype header, with the message and log counts. Messages is the
// inbox; Logs and Settings are plain links to the pages of the other Phase 4 lots until
// their routes exist (then typed links can replace them).
export function NavTabs({
  workspaceSlug,
  counts = {},
}: Readonly<{ workspaceSlug: string; counts?: NavCounts }>) {
  const { t } = useLingui()
  const { pathname } = useLocation()
  const page = (path: string) => (pathname.startsWith(path) ? 'page' : undefined)
  const logs = workspacePagePaths.logs(workspaceSlug)
  const settings = workspacePagePaths.settings(workspaceSlug)
  return (
    <nav
      aria-label={t`Workspace`}
      className="ml-1.5 flex h-full items-stretch gap-0.5 max-md:hidden"
    >
      <Link
        to="/w/$workspaceSlug"
        params={{ workspaceSlug }}
        activeOptions={{ exact: true, includeSearch: false }}
        className={`${tab} ${idle} ${current}`}
      >
        <Trans>Messages</Trans>
        <Count value={counts.messages} />
      </Link>
      <a href={logs} aria-current={page(logs)} className={`${tab} ${idle} ${current}`}>
        <Trans>Logs</Trans>
        <Count value={counts.logs} />
      </a>
      <a href={settings} aria-current={page(settings)} className={`${tab} ${idle} ${current}`}>
        <Trans>Settings</Trans>
      </a>
    </nav>
  )
}
