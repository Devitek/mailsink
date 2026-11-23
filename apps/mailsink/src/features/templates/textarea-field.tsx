import { cn, Textarea } from '@mailsink/ui'
import { type ReactNode, useId } from 'react'

type TextareaFieldProps = {
  label: ReactNode
  name: string
  value: string
  onChange: (value: string) => void
  error?: string
  rows?: number
  placeholder?: string
  mono?: boolean
}

// Labelled multi-line field of the template editor (bodies, sample params).
export function TextareaField({
  label,
  name,
  value,
  onChange,
  error,
  rows = 6,
  placeholder,
  mono = true,
}: TextareaFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-xs font-medium text-ms-text-muted">
        {label}
      </label>
      <Textarea
        id={id}
        name={name}
        rows={rows}
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={cn(mono && 'font-mono text-xs leading-[1.6]')}
      />
      {error && (
        <span id={errorId} className="text-sm text-ms-danger">
          {error}
        </span>
      )}
    </div>
  )
}
