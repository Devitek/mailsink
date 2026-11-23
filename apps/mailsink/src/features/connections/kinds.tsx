import type { ConnectionKind } from '@mailsink/contracts'
import { cn, type SegmentedOption } from '@mailsink/ui'

/** Provider names are brands: not translated. */
export const KIND_LABELS: Record<ConnectionKind, string> = {
  resend: 'Resend',
  brevo: 'Brevo',
  smtp: 'SMTP',
}

const INITIALS: Record<ConnectionKind, string> = { resend: 'RE', brevo: 'BR', smtp: 'SM' }

const TEXT: Record<ConnectionKind, string> = {
  resend: 'text-ms-conn-resend',
  brevo: 'text-ms-conn-brevo',
  smtp: 'text-ms-conn-smtp',
}

export const KIND_OPTIONS: SegmentedOption<ConnectionKind>[] = (
  ['resend', 'brevo', 'smtp'] as const
).map((value) => ({ value, label: KIND_LABELS[value] }))

/** 30 px square with the kind initials in its connection colour (prototype list). */
export function KindMark({
  kind,
  className,
}: Readonly<{ kind: ConnectionKind; className?: string }>) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-[30px] flex-none place-items-center rounded-md border border-ms-border-strong bg-ms-raised font-mono text-[11px] font-semibold',
        TEXT[kind],
        className,
      )}
    >
      {INITIALS[kind]}
    </span>
  )
}
