import { cn, Input } from '@mailsink/ui'

// Numeric field of the override panel (#42): a mono text input (typed strings, validated by
// the schema) with an optional unit inside the box, as in the prototype (`%`, `ms`).

type NumberInputProps = {
  id?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  unit?: string
  invalid?: boolean
  className?: string
  'aria-label'?: string
}

export function NumberInput({
  id,
  value,
  onChange,
  onBlur,
  unit,
  invalid,
  className,
  'aria-label': ariaLabel,
}: NumberInputProps) {
  return (
    <div
      className={cn(
        'flex h-control-md items-center rounded-md border border-ms-border-strong bg-ms-bg pr-[11px] focus-within:focus-ring',
        invalid && 'border-ms-danger',
        className,
      )}
    >
      <Input
        id={id}
        value={value}
        onValueChange={(next: string) => onChange(next)}
        onBlur={onBlur}
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        className="h-full flex-1 rounded-none border-0 bg-transparent pr-1 text-right font-mono focus-visible:shadow-none"
      />
      {unit && <span className="font-mono text-label text-ms-text-faint">{unit}</span>}
    </div>
  )
}
