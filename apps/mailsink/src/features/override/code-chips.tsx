import { cn } from '@mailsink/ui'

// Multiple choice of status codes (chaos HTTP and SMTP codes, #42): toggle buttons drawn
// like the event chips of the prototype webhooks (accent border and tint when pressed).

type CodeChipsProps = {
  label: string
  codes: readonly number[]
  value: number[]
  onChange: (value: number[]) => void
}

export function CodeChips({ label, codes, value, onChange }: CodeChipsProps) {
  return (
    <fieldset aria-label={label} className="flex flex-wrap gap-[5px]">
      {codes.map((code) => {
        const pressed = value.includes(code)
        return (
          <button
            key={code}
            type="button"
            aria-pressed={pressed}
            onClick={() =>
              onChange(
                pressed ? value.filter((c) => c !== code) : [...value, code].sort((a, b) => a - b),
              )
            }
            className={cn(
              'h-control-sm cursor-pointer rounded-sm border px-3.5 font-mono text-xs outline-none transition-colors duration-fast ease-ms focus-visible:focus-ring',
              pressed
                ? 'border-ms-accent-text bg-[color-mix(in_oklch,var(--ms-accent)_10%,transparent)] text-ms-text'
                : 'border-ms-border-strong bg-transparent text-ms-text-muted hover:text-ms-text',
            )}
          >
            {code}
          </button>
        )
      })}
    </fieldset>
  )
}
