import { Trans, useLingui } from '@lingui/react/macro'
import { useId } from 'react'
import { firstError } from '../workspaces/form-fields'
import { CodeChips } from './code-chips'
import { NumberInput } from './number-input'
import { HTTP_CODES, SMTP_CODES } from './override-form'
import { FieldMessage, MonoLabel, Section } from './section'
import type { OverrideForm } from './use-override-form'

// « Latency » and « Chaos » of the prototype panel (#42): the queued -> final status delay
// range, then the share of requests failed before ingestion with the codes answered.

export function LatencySection({ form }: Readonly<{ form: OverrideForm }>) {
  const { t } = useLingui()
  const minId = useId()
  const maxId = useId()
  return (
    <form.Subscribe selector={(s) => s.values.latencyOn}>
      {(on) => (
        <Section
          title={<Trans>Latency</Trans>}
          on={on}
          onToggle={(next) => form.setFieldValue('latencyOn', next)}
          toggleLabel={t`Override the latency`}
          description={
            <Trans>Delay between queued and the final status, drawn in this range.</Trans>
          }
        >
          <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-[13px]">
            {(
              [
                ['minMs', minId],
                ['maxMs', maxId],
              ] as const
            ).map(([name, id]) => (
              <form.Field key={name} name={name}>
                {(field) => (
                  <div className="flex flex-col gap-1.5">
                    <MonoLabel htmlFor={id}>{name}</MonoLabel>
                    <NumberInput
                      id={id}
                      value={field.state.value}
                      onChange={field.handleChange}
                      onBlur={field.handleBlur}
                      unit="ms"
                      invalid={field.state.meta.errors.length > 0}
                    />
                    <FieldMessage message={firstError(field.state.meta.errors)} />
                  </div>
                )}
              </form.Field>
            ))}
          </div>
        </Section>
      )}
    </form.Subscribe>
  )
}

export function ChaosSection({ form }: Readonly<{ form: OverrideForm }>) {
  const { t } = useLingui()
  const rateId = useId()
  return (
    <form.Subscribe selector={(s) => s.values.chaosOn}>
      {(on) => (
        <Section
          title={<Trans>Chaos</Trans>}
          on={on}
          onToggle={(next) => form.setFieldValue('chaosOn', next)}
          toggleLabel={t`Override the chaos`}
          description={
            <Trans>
              Fails this share of requests before ingestion, with one of the chosen codes.
            </Trans>
          }
        >
          <form.Field name="errorRate">
            {(field) => (
              <div className="flex flex-col gap-1.5">
                <MonoLabel htmlFor={rateId}>errorRate</MonoLabel>
                <NumberInput
                  id={rateId}
                  value={field.state.value}
                  onChange={field.handleChange}
                  onBlur={field.handleBlur}
                  unit="%"
                  invalid={field.state.meta.errors.length > 0}
                  className="w-[110px]"
                />
                <FieldMessage message={firstError(field.state.meta.errors)} />
              </div>
            )}
          </form.Field>
          {(
            [
              ['httpCodes', HTTP_CODES, t`HTTP codes answered`],
              ['smtpCodes', SMTP_CODES, t`SMTP codes answered`],
            ] as const
          ).map(([name, codes, label]) => (
            <form.Field key={name} name={name}>
              {(field) => (
                <div className="flex flex-col gap-1.5">
                  <span className="font-mono text-[11.5px] text-ms-text-muted">{label}</span>
                  <CodeChips
                    label={label}
                    codes={codes}
                    value={field.state.value}
                    onChange={field.handleChange}
                  />
                  <FieldMessage message={firstError(field.state.meta.errors)} />
                </div>
              )}
            </form.Field>
          ))}
        </Section>
      )}
    </form.Subscribe>
  )
}
