import { Trans, useLingui } from '@lingui/react/macro'
import { SimulatedStatus } from '@mailsink/contracts'
import { Button, Input, statusColorVar } from '@mailsink/ui'
import type { CSSProperties } from 'react'
import { firstError } from '../workspaces/form-fields'
import { NumberInput } from './number-input'
import type { RuleEffect } from './override-form'
import { FieldMessage, Section } from './section'
import type { OverrideForm } from './use-override-form'

// « Deterministic rules per recipient » of the prototype (#42): a glob pattern and its
// effect (a forced status, or a delay), evaluated in order before the random draw.

const EFFECTS: RuleEffect[] = [
  ...SimulatedStatus.options.filter((s) => s !== 'delivered'),
  'delivered',
  'delay',
]
const MAX_RULES = 50

export function RulesSection({ form }: Readonly<{ form: OverrideForm }>) {
  const { t } = useLingui()
  return (
    <form.Subscribe selector={(s) => s.values.rulesOn}>
      {(on) => (
        <form.Field name="rules" mode="array">
          {(rules) => (
            <Section
              title={<Trans>Deterministic rules per recipient</Trans>}
              on={on}
              onToggle={(next) => form.setFieldValue('rulesOn', next)}
              toggleLabel={t`Override the recipient rules`}
              description={
                <Trans>
                  Evaluated in order, before the random draw. <span className="font-mono">*</span>{' '}
                  wildcards allowed. No rule: the inherited rules are switched off.
                </Trans>
              }
              aside={
                <Button
                  type="button"
                  size="sm"
                  disabled={!on || rules.state.value.length >= MAX_RULES}
                  onClick={() =>
                    rules.pushValue({ match: '', effect: 'hard_bounce', delayMs: '30000' })
                  }
                >
                  <Trans>+ Rule</Trans>
                </Button>
              }
            >
              {rules.state.value.map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: TanStack Form array fields are addressed by index
                <div key={i} className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <form.Field name={`rules[${i}].match`}>
                      {(field) => (
                        <Input
                          value={field.state.value}
                          onValueChange={(v: string) => field.handleChange(v)}
                          onBlur={field.handleBlur}
                          placeholder="*@example.test"
                          aria-label={t`Pattern of rule ${i + 1}`}
                          aria-invalid={field.state.meta.errors.length > 0 || undefined}
                          className="min-w-0 flex-[1_1_160px] font-mono"
                        />
                      )}
                    </form.Field>
                    <span aria-hidden className="text-ms-text-faint">
                      →
                    </span>
                    <form.Field name={`rules[${i}].effect`}>
                      {(field) => (
                        <select
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value as RuleEffect)}
                          aria-label={t`Effect of rule ${i + 1}`}
                          style={
                            {
                              '--status':
                                field.state.value === 'delay'
                                  ? statusColorVar('deferred')
                                  : statusColorVar(field.state.value),
                            } as CSSProperties
                          }
                          className="h-control-md rounded-md border border-ms-border-strong bg-ms-bg px-[11px] font-mono text-xs text-(--status) outline-none focus-visible:focus-ring"
                        >
                          {EFFECTS.map((effect) => (
                            <option key={effect} value={effect}>
                              {effect === 'delay' ? t`delay +ms` : effect}
                            </option>
                          ))}
                        </select>
                      )}
                    </form.Field>
                    <form.Subscribe selector={(s) => s.values.rules[i]?.effect}>
                      {(effect) =>
                        effect === 'delay' && (
                          <form.Field name={`rules[${i}].delayMs`}>
                            {(field) => (
                              <NumberInput
                                value={field.state.value}
                                onChange={field.handleChange}
                                unit="ms"
                                invalid={field.state.meta.errors.length > 0}
                                aria-label={t`Delay of rule ${i + 1}`}
                                className="w-[110px]"
                              />
                            )}
                          </form.Field>
                        )
                      }
                    </form.Subscribe>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t`Remove rule ${i + 1}`}
                      onClick={() => rules.removeValue(i)}
                    >
                      ×
                    </Button>
                  </div>
                  <form.Subscribe
                    selector={(s) => [
                      ...(s.fieldMeta[`rules[${i}].match`]?.errors ?? []),
                      ...(s.fieldMeta[`rules[${i}].delayMs`]?.errors ?? []),
                    ]}
                  >
                    {(errors) => <FieldMessage message={firstError(errors)} />}
                  </form.Subscribe>
                </div>
              ))}
            </Section>
          )}
        </form.Field>
      )}
    </form.Subscribe>
  )
}
