import { Trans, useLingui } from '@lingui/react/macro'
import { SegmentedControl } from '@mailsink/ui'
import { firstError } from '../workspaces/form-fields'
import { NumberInput } from './number-input'
import { FieldMessage, Section } from './section'
import type { OverrideForm } from './use-override-form'

// « Rate limit » of the prototype panel (#42): a temporary token bucket per second or per
// minute; beyond it the API answers 429 and SMTP 421.

export function RateLimitSection({ form }: Readonly<{ form: OverrideForm }>) {
  const { t } = useLingui()
  return (
    <form.Subscribe selector={(s) => s.values.rateLimitOn}>
      {(on) => (
        <Section
          title={<Trans>Rate limit</Trans>}
          on={on}
          onToggle={(next) => form.setFieldValue('rateLimitOn', next)}
          toggleLabel={t`Override the rate limit`}
        >
          <div className="flex flex-wrap items-center gap-[13px]">
            <form.Field name="limit">
              {(field) => (
                <NumberInput
                  value={field.state.value}
                  onChange={field.handleChange}
                  onBlur={field.handleBlur}
                  invalid={field.state.meta.errors.length > 0}
                  aria-label={t`Requests allowed per window`}
                  className="w-[110px]"
                />
              )}
            </form.Field>
            <form.Field name="window">
              {(field) => (
                <SegmentedControl
                  mono
                  aria-label={t`Rate limit window`}
                  options={[
                    { value: 'second', label: t`req/s` },
                    { value: 'minute', label: t`req/min` },
                  ]}
                  value={field.state.value}
                  onValueChange={field.handleChange}
                  disabled={!on}
                />
              )}
            </form.Field>
            <span className="text-xs text-ms-text-faint">
              <Trans>
                beyond: <span className="font-mono">429</span> /{' '}
                <span className="font-mono">421</span>
              </Trans>
            </span>
          </div>
          <form.Subscribe selector={(s) => s.fieldMeta.limit?.errors ?? []}>
            {(errors) => <FieldMessage message={firstError(errors)} />}
          </form.Subscribe>
        </Section>
      )}
    </form.Subscribe>
  )
}
