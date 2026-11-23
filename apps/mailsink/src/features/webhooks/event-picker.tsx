import { useLingui } from '@lingui/react/macro'
import type { CanonicalEvent, PayloadFormat } from '@mailsink/contracts'
import { cn } from '@mailsink/ui'
import type { EventCatalog } from '../../server-fns/settings-types'
import { isChoiceOn, toggleChoice, unsupportedEvents } from './endpoint-form'
import { UnsupportedWarning } from './event-list'

type EventPickerProps = {
  catalog: EventCatalog
  format: PayloadFormat
  value: CanonicalEvent[]
  onChange: (events: CanonicalEvent[]) => void
  labelId: string
}

// Event chips of the prototype endpoint card, in the dialect of the chosen format (Brevo
// `hardBounce`, Resend `email.delivery_delayed`…). Each chip toggles the canonical events
// it stands for; events the format cannot represent are listed under the chips (D22).
export function EventPicker({ catalog, format, value, onChange, labelId }: EventPickerProps) {
  const { t } = useLingui()
  const unsupported = unsupportedEvents(catalog, format, value)
  return (
    <div className="flex flex-col gap-2">
      <fieldset aria-labelledby={labelId} className="m-0 flex flex-wrap gap-[5px] border-0 p-0">
        {catalog[format].map((choice) => {
          const on = isChoiceOn(value, choice)
          const name = choice.name
          return (
            <button
              key={choice.name}
              type="button"
              aria-pressed={on}
              title={choice.events.join(', ')}
              aria-label={t`Event ${name}`}
              onClick={() => onChange(toggleChoice(value, choice))}
              className={cn(
                'inline-flex h-[22px] cursor-pointer items-center gap-1.5 rounded-xs border px-[9px] font-mono text-label outline-none transition-colors duration-fast ease-ms focus-visible:focus-ring',
                on
                  ? 'border-ms-accent-text bg-[color-mix(in_oklch,var(--ms-accent)_10%,transparent)] text-ms-text'
                  : 'border-ms-border-strong bg-transparent text-ms-text-muted hover:text-ms-text',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'grid size-2.5 place-items-center rounded-xs border text-[8px] leading-none text-ms-on-accent',
                  on ? 'border-ms-accent-text bg-ms-accent' : 'border-ms-border-strong',
                )}
              >
                {on ? '✓' : ''}
              </span>
              {choice.name}
            </button>
          )
        })}
      </fieldset>
      {unsupported.length > 0 && <UnsupportedWarning events={unsupported} />}
    </div>
  )
}
