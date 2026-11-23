import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@mailsink/ui'
import { formatTimeLeft } from './format-ttl'

const pill =
  'inline-flex h-[19px] shrink-0 items-center rounded-sm px-2 font-mono text-badge font-medium whitespace-nowrap text-ms-status-deferred bg-[color-mix(in_oklch,var(--ms-status-deferred)_15%,transparent)]'

// Ephemeral marker of the prototype: deferred-blue pill with the time left before the GC.
// The time depends on the clock, so server and browser may differ by a minute at hydration.
export function EphemeralBadge({
  expiresAt,
  withLabel = false,
  className,
}: Readonly<{ expiresAt: string | null; withLabel?: boolean; className?: string }>) {
  const { i18n } = useLingui()
  const left = formatTimeLeft(expiresAt, i18n.locale)
  return (
    <span className={cn(pill, className)} suppressHydrationWarning>
      {withLabel ? (
        left ? (
          <Trans>Ephemeral · {left}</Trans>
        ) : (
          <Trans>Ephemeral</Trans>
        )
      ) : (
        (left ?? <Trans>Ephemeral</Trans>)
      )}
    </span>
  )
}
