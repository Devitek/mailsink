import { cn, Switch } from '@mailsink/ui'
import { type ReactNode, useId } from 'react'

// One section of the override panel (#42): the uppercase heading of the prototype, a switch
// deciding whether the section is part of the override, then its fields (dimmed when off).

type SectionProps = {
  title: ReactNode
  /** Undefined: always part of the panel (target and expiry). */
  on?: boolean
  onToggle?: (on: boolean) => void
  /** Accessible name of the switch. */
  toggleLabel?: string
  aside?: ReactNode
  description?: ReactNode
  children: ReactNode
}

export function Section({
  title,
  on,
  onToggle,
  toggleLabel,
  aside,
  description,
  children,
}: SectionProps) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-[13px]">
      <div className="flex items-center gap-2.5">
        {on !== undefined && (
          <Switch
            checked={on}
            onCheckedChange={(next: boolean) => onToggle?.(next)}
            aria-label={toggleLabel}
          />
        )}
        <h3
          id={headingId}
          className="flex-1 text-label font-medium tracking-[0.06em] text-ms-text-faint uppercase"
        >
          {title}
        </h3>
        {aside}
      </div>
      {description && <p className="-mt-1 text-xs text-ms-text-faint">{description}</p>}
      <fieldset
        disabled={on === false}
        className={cn('flex min-w-0 flex-col gap-[13px]', on === false && 'opacity-50')}
      >
        {children}
      </fieldset>
    </section>
  )
}

/** Small mono label above an input (`minMs`, `errorRate`), as in the prototype. */
export function MonoLabel({
  htmlFor,
  children,
}: Readonly<{ htmlFor: string; children: ReactNode }>) {
  return (
    <label htmlFor={htmlFor} className="font-mono text-[11.5px] text-ms-text-muted">
      {children}
    </label>
  )
}

export function FieldMessage({ message }: Readonly<{ message?: string }>) {
  if (!message) return null
  return <p className="text-xs text-ms-danger">{message}</p>
}
