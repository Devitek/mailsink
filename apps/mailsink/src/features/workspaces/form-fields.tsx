import { cn, Field, FieldDescription, FieldError, FieldLabel, Input } from '@mailsink/ui'
import type { ReactNode } from 'react'

// Text field of the management forms (#38), fed by a TanStack Form field: label, input,
// optional description and the first error once the field was touched (or a server one).

/** First message of TanStack Form errors (Standard Schema issues or plain strings). */
export function firstError(errors: readonly unknown[]): string | undefined {
  for (const error of errors) {
    if (typeof error === 'string') return error
    if (error && typeof error === 'object' && 'message' in error) return String(error.message)
  }
  return undefined
}

type TextFieldProps = {
  label: ReactNode
  name: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  /** Shown when set: validation message of a touched field or a server conflict. */
  error?: string
  description?: ReactNode
  placeholder?: string
  mono?: boolean
  /** Fixed text inside the input on the left (`/w/`). */
  prefix?: string
  /** Unit after the input (`req/s`): makes the input narrow. */
  suffix?: string
  inputMode?: 'numeric' | 'text'
  autoFocus?: boolean
}

export function TextField({
  label,
  name,
  value,
  onChange,
  onBlur,
  error,
  description,
  placeholder,
  mono = false,
  prefix,
  suffix,
  inputMode,
  autoFocus,
}: TextFieldProps) {
  const input = (
    <Input
      name={name}
      value={value}
      onValueChange={(next: string) => onChange(next)}
      onBlur={onBlur}
      placeholder={placeholder}
      inputMode={inputMode}
      autoFocus={autoFocus}
      autoComplete="off"
      spellCheck={false}
      className={cn(
        mono && 'font-mono',
        prefix &&
          'h-full flex-1 rounded-none border-0 bg-transparent pl-1 focus-visible:shadow-none',
        suffix && 'w-[110px]',
      )}
    />
  )
  return (
    <Field invalid={error !== undefined} className="gap-2">
      <FieldLabel className="text-xs text-ms-text-muted">{label}</FieldLabel>
      {prefix ? (
        <div className="flex h-control-md items-center overflow-hidden rounded-md border border-ms-border-strong bg-ms-bg focus-within:focus-ring">
          <span className="pl-3.5 font-mono text-sm text-ms-text-faint">{prefix}</span>
          {input}
        </div>
      ) : suffix ? (
        <div className="flex items-center gap-2.5">
          {input}
          <span className="font-mono text-xs text-ms-text-faint">{suffix}</span>
        </div>
      ) : (
        input
      )}
      {description && <FieldDescription>{description}</FieldDescription>}
      {error && <FieldError match>{error}</FieldError>}
    </Field>
  )
}
