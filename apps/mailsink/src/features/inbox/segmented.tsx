import { SegmentedControl, type SegmentedOption } from '@mailsink/ui'

// Segmented toggles of the inbox and the viewer (All / Resend…, Desktop / Mobile, light /
// dark background): the design system SegmentedControl (radio group), filling the width
// of its container. Kept as a thin adapter so its callers stay unchanged.

export type { SegmentedOption }

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
    <SegmentedControl
      aria-label={label}
      options={options}
      value={value}
      onValueChange={onChange}
      className={className}
      fill
    />
  )
}

/** Mono count next to a segment or chip label. */
export function Count({ value }: Readonly<{ value: number | undefined }>) {
  return <span className="font-mono text-badge text-ms-text-faint">{value ?? 0}</span>
}
