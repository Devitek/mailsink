import { cn } from '@mailsink/ui'
import type { ReactNode } from 'react'

// Segmented toggle of the prototype (All / Resend…, Desktop / Mobile, light / dark
// background): 24 px buttons in a bordered well, the pressed one raised.

export interface SegmentedOption<V extends string> {
  value: V
  label: ReactNode
  /** Accessible name when the label is not plain text (a count next to it). */
  title?: string
}

export function Segmented<V extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: Readonly<{
  label: string
  options: readonly SegmentedOption<V>[]
  value: V
  onChange: (value: V) => void
  className?: string
}>) {
  return (
    <fieldset
      aria-label={label}
      className={cn('flex gap-0.5 rounded-md border border-ms-border bg-ms-bg p-0.5', className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          aria-label={option.title}
          onClick={() => onChange(option.value)}
          className="flex h-control-sm min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xs px-3.5 text-xs whitespace-nowrap text-ms-text-muted transition-colors duration-fast ease-ms outline-none hover:text-ms-text focus-visible:focus-ring aria-pressed:bg-ms-hover aria-pressed:text-ms-text aria-pressed:shadow-[inset_0_0_0_1px_var(--ms-border-strong)]"
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  )
}

/** Mono count next to a segment or chip label. */
export function Count({ value }: Readonly<{ value: number | undefined }>) {
  return <span className="font-mono text-badge text-ms-text-faint">{value ?? 0}</span>
}
