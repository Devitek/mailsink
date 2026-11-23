import { Trans, useLingui } from '@lingui/react/macro'
import { StatusBadge } from '@mailsink/ui'
import { useForm } from '@tanstack/react-form'
import type { ReactNode } from 'react'
import type { SettingsPage } from '../../server-fns/settings-types'
import { firstError, TextField } from '../workspaces/form-fields'
import {
  DRAWN_STATUSES,
  deliveredShare,
  simulationSchema,
  simulationValues,
  toSimulationPatch,
} from './defaults-form'
import { useSaveDefaults } from './queries'
import { SaveState } from './save-state'
import { SectionHeader, SettingsCard } from './section-header'

type Meta = { errors: readonly unknown[] }
const overbooked = (rates: Record<string, string>) =>
  Object.values(rates).reduce((sum, v) => sum + (Number(v) || 0), 0) > 100
const errorOf = (meta: Meta) => firstError(meta.errors)

// « Simulation & rate limit » section (#43): the workspace defaults every connection
// inherits (D73): status rates drawn in order, the remainder delivered (D71), latency,
// automatic opens and clicks (D143), and the default rate limit applied per connection
// (D90). Recipient rules are kept as they are; overrides stay in the override panel.
export function SimulationSection({ page }: Readonly<{ page: SettingsPage }>) {
  const { t } = useLingui()
  const { workspace } = page
  const save = useSaveDefaults(workspace.slug)
  const schema = simulationSchema({
    number: t`A number between the allowed bounds.`,
    sum: t`The rates add up to more than 100 %.`,
    latency: t`The maximum must be at least the minimum.`,
  })
  const form = useForm({
    defaultValues: simulationValues(workspace.simulation, workspace.rateLimit),
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: ({ value }) => save.mutateAsync(toSimulationPatch(value, workspace.simulation.rules)),
  })
  const rules = workspace.simulation.rules.length

  const numberField = (
    name:
      | 'latencyMin'
      | 'latencyMax'
      | 'openRate'
      | 'clickRate'
      | 'rateLimit'
      | 'rateWindow'
      | 'burst',
    label: ReactNode,
    suffix: string,
    placeholder?: string,
  ) => (
    <form.Field name={name}>
      {(field) => (
        <TextField
          label={label}
          name={field.name}
          value={field.state.value}
          onChange={field.handleChange}
          onBlur={field.handleBlur}
          error={errorOf(field.state.meta)}
          placeholder={placeholder}
          inputMode="numeric"
          suffix={suffix}
          mono
        />
      )}
    </form.Field>
  )

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
      className="flex flex-col gap-[29px]"
    >
      <div>
        <SectionHeader
          title={<Trans>Default simulation</Trans>}
          description={
            <Trans>Drawn in this order for each recipient; the remainder is delivered.</Trans>
          }
        />
        <SettingsCard className="flex flex-col gap-[22px]">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-[18px]">
            {DRAWN_STATUSES.map((status) => (
              <form.Field key={status} name={`rates.${status}`}>
                {(field) => (
                  <TextField
                    label={<StatusBadge status={status}>{status}</StatusBadge>}
                    name={field.name}
                    value={field.state.value}
                    onChange={field.handleChange}
                    error={errorOf(field.state.meta)}
                    placeholder="0"
                    inputMode="numeric"
                    suffix="%"
                    mono
                  />
                )}
              </form.Field>
            ))}
            <form.Subscribe selector={(state) => state.values.rates}>
              {(rates) => (
                <div className="flex flex-col gap-2">
                  <StatusBadge status="delivered">delivered</StatusBadge>
                  <output data-testid="delivered-share" className="font-mono text-md">
                    {deliveredShare(rates)} %
                  </output>
                </div>
              )}
            </form.Subscribe>
          </div>
          <form.Subscribe selector={(state) => overbooked(state.values.rates)}>
            {(over) =>
              over && (
                <p role="alert" className="text-sm text-ms-danger">
                  <Trans>The rates add up to more than 100 %.</Trans>
                </p>
              )
            }
          </form.Subscribe>
          <div className="flex flex-wrap gap-[21px]">
            {numberField('latencyMin', <Trans>Latency min</Trans>, 'ms')}
            {numberField('latencyMax', <Trans>Latency max</Trans>, 'ms')}
            {numberField('openRate', <Trans>Opened</Trans>, '%')}
            {numberField('clickRate', <Trans>Clicked</Trans>, '%')}
          </div>
          <p className="text-xs text-ms-text-faint">
            <Trans>
              Recipient rules: {rules}. They are kept as they are; the override panel changes the
              simulation for a while.
            </Trans>
          </p>
        </SettingsCard>
      </div>
      <div>
        <SectionHeader
          title={<Trans>Default rate limit</Trans>}
          description={
            <Trans>Applied to each connection that sets none (HTTP 429, SMTP 451).</Trans>
          }
        />
        <SettingsCard className="flex flex-wrap gap-[21px]">
          {numberField('rateLimit', <Trans>Requests</Trans>, t`per window`, t`unlimited`)}
          {numberField('rateWindow', <Trans>Window</Trans>, 's')}
          {numberField('burst', <Trans>Burst</Trans>, t`tokens`, t`same as the limit`)}
        </SettingsCard>
      </div>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => <SaveState pending={pending} saved={save.isSuccess} failed={save.isError} />}
      </form.Subscribe>
    </form>
  )
}
