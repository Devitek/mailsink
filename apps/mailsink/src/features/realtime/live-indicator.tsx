import { useLingui } from '@lingui/react/macro'
import { cn } from '@mailsink/ui'
import type { StreamState } from './stream-connection'

// « SSE Live » of the prototype header: the state of the workspace stream.
export function LiveIndicator({ state }: Readonly<{ state: StreamState }>) {
  const { t } = useLingui()
  const live = state === 'live'
  const label = live ? t`Live` : state === 'connecting' ? t`Connecting…` : t`Reconnecting…`
  return (
    <output
      aria-live="polite"
      title={live ? t`Real-time stream (Server-Sent Events) connected` : label}
      className="flex shrink-0 items-center gap-[9px] font-mono text-[11.5px] font-medium text-ms-text-muted"
    >
      <span
        aria-hidden
        className={cn(
          'size-[7px] rounded-full',
          live ? 'bg-ms-status-delivered motion-safe:animate-pulse' : 'bg-ms-status-soft-bounce',
        )}
      />
      <span className="max-lg:sr-only">{live ? `SSE ${label}` : label}</span>
    </output>
  )
}
