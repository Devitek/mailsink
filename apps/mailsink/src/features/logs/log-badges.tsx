import type { DeliveryStatus } from '@mailsink/contracts'
import { cn, statusColorVar } from '@mailsink/ui'
import type { CSSProperties, ReactNode } from 'react'

// Badges of the prototype log table: the type (outlined, 19 px, 10.5 px mono) and the
// status (filled tint, 600). Technical values (dialects, codes, outcomes), never translated.

export type LogKind = 'api' | 'smtp' | 'webhook'

const KIND_COLOR: Record<LogKind, string> = {
  api: 'var(--ms-accent-text)',
  smtp: 'var(--ms-conn-smtp)',
  webhook: 'var(--ms-status-complained)',
}

export function TypeBadge({
  kind,
  children,
  size = 'sm',
}: Readonly<{ kind: LogKind; children: ReactNode; size?: 'sm' | 'md' }>) {
  return (
    <span
      style={{ '--tone': KIND_COLOR[kind] } as CSSProperties}
      className={cn(
        'inline-flex items-center rounded-xs border border-[color-mix(in_oklch,var(--tone)_35%,transparent)] font-mono font-medium whitespace-nowrap text-(--tone)',
        size === 'sm' ? 'h-[19px] px-2 text-badge' : 'h-5 px-[9px] text-label',
      )}
    >
      {children}
    </span>
  )
}

export function CodeBadge({
  tone,
  children,
  size = 'sm',
  title,
}: Readonly<{ tone: DeliveryStatus; children: ReactNode; size?: 'sm' | 'md'; title?: string }>) {
  return (
    <span
      title={title}
      style={{ '--tone': statusColorVar(tone) } as CSSProperties}
      className={cn(
        'inline-flex max-w-full items-center truncate rounded-xs bg-[color-mix(in_oklch,var(--tone)_16%,transparent)] font-mono font-semibold whitespace-nowrap text-(--tone)',
        size === 'sm' ? 'h-[19px] px-2 text-label' : 'h-5 px-[9px] text-label',
      )}
    >
      {children}
    </span>
  )
}

/** `38 ms`, amber above one second as in the prototype. */
export function Duration({ ms }: Readonly<{ ms: number | null }>) {
  if (ms === null) return <span className="text-ms-text-faint">-</span>
  return (
    <span className={ms > 1000 ? 'text-ms-status-soft-bounce' : 'text-ms-text-muted'}>{ms} ms</span>
  )
}
