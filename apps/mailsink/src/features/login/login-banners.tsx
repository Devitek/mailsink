import { Trans } from '@lingui/react/macro'
import { cn } from '@mailsink/ui'
import type { ReactNode } from 'react'

function Banner({
  tone,
  role,
  icon,
  children,
}: Readonly<{
  tone: 'info' | 'danger'
  role: 'status' | 'alert'
  icon: string
  children: ReactNode
}>) {
  return (
    <div
      role={role}
      className={cn(
        'flex items-start gap-[12px] rounded-lg border px-[14px] py-[12px] text-body leading-normal',
        tone === 'info'
          ? 'border-ms-border-strong bg-ms-raised text-ms-text'
          : 'border-[color-mix(in_oklch,var(--ms-danger)_45%,transparent)] bg-[color-mix(in_oklch,var(--ms-danger)_10%,transparent)] text-ms-text',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'mt-[2px] flex size-[16px] shrink-0 items-center justify-center rounded-full border font-mono text-badge',
          tone === 'info'
            ? 'border-ms-text-muted text-ms-text-muted'
            : 'border-ms-danger text-ms-danger',
        )}
      >
        {icon}
      </span>
      <p>{children}</p>
    </div>
  )
}

/** L1d: the session ended; signing in returns to `path` when there is one. */
export function ExpiredBanner({ path }: Readonly<{ path?: string }>) {
  return (
    <Banner tone="info" role="status" icon="i">
      {path ? (
        <Trans>
          Your session has expired. Sign in again to return to{' '}
          <code className="font-mono text-sm break-all">{path}</code>.
        </Trans>
      ) : (
        <Trans>Your session has expired. Sign in again.</Trans>
      )}
    </Banner>
  )
}

/**
 * L1e: live countdown, from the server's Retry-After (B2-3). Assistive technologies get the
 * initial duration once: a ticking value in an alert would be announced every second.
 */
export function PausedBanner({ countdown, total }: Readonly<{ countdown: string; total: string }>) {
  return (
    <Banner tone="danger" role="alert" icon="!">
      <Trans>
        <strong className="font-semibold">Too many attempts.</strong> To protect this instance,
        sign-in is paused for{' '}
        <code className="font-mono font-medium">
          <span aria-hidden>{countdown}</span>
          <span className="sr-only">{total}</span>
        </code>
        .
      </Trans>
    </Banner>
  )
}

/** The server could not be reached or failed: not the key's fault. */
export function FailedBanner() {
  return (
    <Banner tone="danger" role="alert" icon="!">
      <Trans>Sign-in failed. Check your connection and try again.</Trans>
    </Banner>
  )
}
