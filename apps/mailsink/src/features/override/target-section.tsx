import { Trans, useLingui } from '@lingui/react/macro'
import { cn, SegmentedControl } from '@mailsink/ui'
import type { OverrideConnection } from '../../server-fns/override-types'
import { type Expiry, type OverrideTarget, WORKSPACE_TARGET } from './override-form'
import { Section } from './section'
import type { OverrideForm } from './use-override-form'

// « Target and duration » of the prototype panel (#42): the whole workspace or one
// connection (override colour when chosen), then the expiry of the override.

type TargetSectionProps = {
  form: OverrideForm
  target: OverrideTarget
  connections: OverrideConnection[]
  /** Targets with an active override: marked with a dot. */
  active: ReadonlySet<OverrideTarget>
  onTarget: (target: OverrideTarget) => void
}

export function TargetSection({ form, target, connections, active, onTarget }: TargetSectionProps) {
  const { t } = useLingui()
  const targets = [
    { id: WORKSPACE_TARGET, label: t`Whole workspace` },
    ...connections.map((c) => ({ id: c.id, label: c.name })),
  ]
  return (
    <Section title={<Trans>Target and duration</Trans>}>
      <fieldset aria-label={t`Override target`} className="flex flex-wrap gap-[5px]">
        {targets.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={target === id}
            onClick={() => onTarget(id)}
            className={cn(
              'flex h-[26px] cursor-pointer items-center gap-2 rounded-sm border border-ms-border-strong px-3.5 font-mono text-xs outline-none transition-colors duration-fast ease-ms focus-visible:focus-ring',
              target === id
                ? 'bg-[color-mix(in_oklch,var(--ms-override)_14%,transparent)] text-ms-override'
                : 'bg-transparent text-ms-text-muted hover:text-ms-text',
            )}
          >
            {active.has(id) && (
              <span aria-hidden className="size-1.5 rounded-full bg-ms-override" />
            )}
            {label}
          </button>
        ))}
      </fieldset>
      <form.Field name="expiry">
        {(field) => (
          <div className="flex items-center gap-[13px]">
            <span className="text-xs text-ms-text-muted">
              <Trans>Expires</Trans>
            </span>
            <SegmentedControl<Expiry>
              aria-label={t`Expiry`}
              options={[
                { value: '15m', label: t`15 min` },
                { value: '1h', label: t`1 h` },
                { value: 'reset', label: t`Until reset` },
              ]}
              value={field.state.value}
              onValueChange={field.handleChange}
            />
          </div>
        )}
      </form.Field>
    </Section>
  )
}
