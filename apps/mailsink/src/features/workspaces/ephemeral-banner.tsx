import { Trans, useLingui } from '@lingui/react/macro'
import type { WorkspaceSummary } from '../../server-fns/workspace-types'
import { useNow } from '../inbox/relative-time'
import { formatCountdown, formatTtl } from './format-ttl'

// Ephemeral banner of the prototype, under the header of an ephemeral workspace: what it
// is and who created it (`metadata.createdBy`, when the Admin API caller gave one), then
// the live countdown to the GC purge and how much of its idle TTL is left. Stream frames
// of ingestion and API calls push the expiry back (realtime/apply-stream-event.ts). The
// countdown depends on the clock, so server and browser differ by a second at hydration.
export function EphemeralBanner({ workspace }: Readonly<{ workspace: WorkspaceSummary }>) {
  const { t, i18n } = useLingui()
  const now = useNow(1000)
  const { expiresAt, idleTtlSeconds: ttl } = workspace
  if (!workspace.ephemeral || !expiresAt) return null
  const left = Math.max(0, Date.parse(expiresAt) - now)
  const pct = ttl ? Math.min(100, (left / (ttl * 1000)) * 100) : 100
  return (
    <section
      aria-label={t`Ephemeral workspace`}
      className="flex shrink-0 flex-wrap items-center gap-x-[18px] gap-y-2.5 border-b border-ms-border bg-[color-mix(in_oklch,var(--ms-status-deferred)_7%,var(--ms-panel))] px-[19px] py-3"
    >
      <span className="inline-flex h-5 items-center rounded-sm bg-[color-mix(in_oklch,var(--ms-status-deferred)_16%,transparent)] px-[11px] font-mono text-label font-semibold text-ms-status-deferred">
        ephemeral: true
      </span>
      <p className="min-w-0 flex-[1_1_320px] text-sm">
        <span className="font-medium">
          <Trans>Ephemeral workspace</Trans>
        </span>{' '}
        <span className="text-ms-text-muted">
          {workspace.createdBy ? (
            <Trans>
              created by <span className="font-mono text-ms-text">{workspace.createdBy}</span>{' '}
              through <code className="font-mono">POST /admin/workspaces</code> · hidden from the
              main list by default · purged automatically after inactivity.
            </Trans>
          ) : (
            <Trans>
              created through <code className="font-mono">POST /admin/workspaces</code> · hidden
              from the main list by default · purged automatically after inactivity.
            </Trans>
          )}
        </span>
      </p>
      <div className="flex shrink-0 items-center gap-[13px]">
        <span className="text-[11.5px] text-ms-text-muted">
          <Trans>Purged in</Trans>
        </span>
        <span
          className="min-w-[62px] font-mono text-md font-semibold text-ms-status-deferred"
          suppressHydrationWarning
        >
          {formatCountdown(expiresAt, now)}
        </span>
        <div
          role="progressbar"
          aria-label={t`Idle time left`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          className="h-1 w-[120px] overflow-hidden rounded-xs bg-ms-border-strong"
        >
          <div
            className="h-full bg-ms-status-deferred"
            style={{ width: `${pct}%` }}
            suppressHydrationWarning
          />
        </div>
        {ttl ? (
          <span className="font-mono text-label text-ms-text-faint">
            TTL {formatTtl(ttl, i18n.locale)}
          </span>
        ) : null}
      </div>
    </section>
  )
}
