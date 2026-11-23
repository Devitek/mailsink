import { Plural, Trans } from '@lingui/react/macro'
import { buttonVariants } from '@mailsink/ui'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { suppressionsQuery } from '../suppressions/queries'
import { SectionHeader, SettingsCard } from './section-header'

// « Suppression list » block of the prototype « Rétention & suppression » section: what
// the list does, how many addresses it holds, and the way to the full list page.
export function SuppressionCard({ slug }: Readonly<{ slug: string }>) {
  const { data } = useInfiniteQuery(suppressionsQuery(slug, undefined))
  const total = data?.pages[0]?.total
  return (
    <div className="mt-[31px]">
      <SectionHeader
        title={<Trans>Suppression list</Trans>}
        description={
          <Trans>
            Sends to these addresses are stored <span className="font-mono">suppressed</span>{' '}
            without drawing a status.
          </Trans>
        }
      >
        {total !== undefined && (
          <span className="font-mono text-xs text-ms-text-muted">
            <Plural value={total} one="# address" other="# addresses" />
          </span>
        )}
      </SectionHeader>
      <SettingsCard className="flex flex-wrap items-center justify-between gap-[13px]">
        <p className="text-sm text-ms-text-muted">
          <Trans>Hard bounces and complaints of the simulation add the address here.</Trans>
        </p>
        <Link
          to="/w/$workspaceSlug/suppressions"
          params={{ workspaceSlug: slug }}
          className={buttonVariants({ size: 'sm' })}
        >
          <Trans>Manage the suppression list →</Trans>
        </Link>
      </SettingsCard>
    </div>
  )
}
