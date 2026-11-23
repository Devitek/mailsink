import { Trans, useLingui } from '@lingui/react/macro'
import { cn, statusColorVar } from '@mailsink/ui'
import type { CSSProperties } from 'react'
import { NumberInput } from './number-input'
import { deliveredRemainder, RATE_STATUSES, type RateStatus } from './override-form'
import { Section } from './section'
import type { OverrideForm } from './use-override-form'

// « Status rates » of the prototype (#42): a stacked bar, the total, then one slider and one
// field per status. `delivered` is not typed: it takes the remainder (simulation/draw.ts).

const color = (status: RateStatus | 'delivered') =>
  ({ '--status': statusColorVar(status) }) as CSSProperties

export function RatesSection({ form }: Readonly<{ form: OverrideForm }>) {
  const { t } = useLingui()
  return (
    <form.Subscribe selector={(s) => [s.values.ratesOn, s.values.rates] as const}>
      {([on, rates]) => {
        const delivered = deliveredRemainder(rates)
        const over = delivered < 0
        const scale = Math.max(100, 100 - delivered)
        const segments = [
          ...RATE_STATUSES.map((s) => [s, Number(rates[s]) || 0] as const),
          ['delivered', Math.max(0, delivered)] as const,
        ]
        return (
          <Section
            title={<Trans>Status rates</Trans>}
            on={on}
            onToggle={(next) => form.setFieldValue('ratesOn', next)}
            toggleLabel={t`Override the status rates`}
            aside={
              <span
                className={cn(
                  'font-mono text-sm font-semibold',
                  over ? 'text-ms-danger' : 'text-ms-status-delivered',
                )}
              >
                {100 - delivered}% + {Math.max(0, delivered)}% delivered
              </span>
            }
          >
            <div aria-hidden className="flex h-2.5 overflow-hidden rounded-[5px] bg-ms-border">
              {segments.map(([status, value]) => (
                <div
                  key={status}
                  style={{ ...color(status), width: `${(value / scale) * 100}%` }}
                  className="h-full border-r border-ms-panel bg-(--status) transition-[width] duration-fast"
                />
              ))}
            </div>
            <p
              role={over ? 'alert' : undefined}
              className={cn(
                'rounded-md px-3.5 py-[9px] text-xs',
                over
                  ? 'bg-[color-mix(in_oklch,var(--ms-danger)_10%,transparent)] text-ms-danger'
                  : 'bg-[color-mix(in_oklch,var(--ms-status-delivered)_10%,transparent)] text-ms-status-delivered',
              )}
            >
              {over ? (
                <Trans>Total above 100 % (+{-delivered} %): lower one or more rates.</Trans>
              ) : (
                <Trans>
                  The remaining {delivered} % are delivered. Each send draws its status from these
                  rates.
                </Trans>
              )}
            </p>
            <div className="flex flex-col gap-[5px]">
              {RATE_STATUSES.map((status) => (
                <form.Field key={status} name={`rates.${status}`}>
                  {(field) => (
                    <div
                      style={color(status)}
                      className="grid h-8 grid-cols-[118px_minmax(0,1fr)_70px] items-center gap-4"
                    >
                      <span className="flex items-center gap-[9px] font-mono text-xs">
                        <span aria-hidden className="size-2 rounded-[2px] bg-(--status)" />
                        {status}
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Number(field.state.value) || 0}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-label={t`${status} rate (slider)`}
                        className="w-full accent-(--status)"
                      />
                      <NumberInput
                        value={field.state.value}
                        onChange={field.handleChange}
                        onBlur={field.handleBlur}
                        unit="%"
                        invalid={field.state.meta.errors.length > 0}
                        aria-label={t`${status} rate`}
                        className="h-7"
                      />
                    </div>
                  )}
                </form.Field>
              ))}
              <div
                style={color('delivered')}
                className="grid h-8 grid-cols-[118px_minmax(0,1fr)_70px] items-center gap-4"
              >
                <span className="flex items-center gap-[9px] font-mono text-xs">
                  <span aria-hidden className="size-2 rounded-[2px] bg-(--status)" />
                  delivered
                </span>
                <span className="text-xs text-ms-text-faint">
                  <Trans>Remainder</Trans>
                </span>
                <output
                  data-testid="delivered-remainder"
                  className="pr-[11px] text-right font-mono text-xs"
                >
                  {Math.max(0, delivered)} %
                </output>
              </div>
            </div>
          </Section>
        )
      }}
    </form.Subscribe>
  )
}
