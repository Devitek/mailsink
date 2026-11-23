import { Trans, useLingui } from '@lingui/react/macro'
import { Link } from '@tanstack/react-router'

const tab =
  'flex h-full items-center border-b-2 px-3.5 font-medium whitespace-nowrap outline-none transition-colors duration-fast ease-ms focus-visible:text-ms-text'

// Workspace tabs of the prototype header. Messages is the workspace page; Logs and Settings
// are placeholders until their screens land (#39 and the Phase 4 issues): shown, inert.
export function NavTabs({ workspaceSlug }: Readonly<{ workspaceSlug: string }>) {
  const { t } = useLingui()
  const soon = t`Not available yet`
  return (
    <nav
      aria-label={t`Workspace`}
      className="ml-1.5 flex h-full items-stretch gap-0.5 max-md:hidden"
    >
      <Link
        to="/w/$workspaceSlug"
        params={{ workspaceSlug }}
        activeOptions={{ exact: true }}
        className={`${tab} border-transparent text-ms-text-muted hover:text-ms-text aria-[current=page]:border-ms-accent-text aria-[current=page]:text-ms-text`}
      >
        <Trans>Messages</Trans>
      </Link>
      {[t`Logs`, t`Settings`].map((label) => (
        <span
          key={label}
          aria-disabled="true"
          title={soon}
          className={`${tab} cursor-not-allowed border-transparent text-ms-text-faint`}
        >
          {label}
        </span>
      ))}
    </nav>
  )
}
