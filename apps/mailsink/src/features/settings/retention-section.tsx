import { Trans, useLingui } from '@lingui/react/macro'
import { useForm } from '@tanstack/react-form'
import type { SettingsPage } from '../../server-fns/settings-types'
import { firstError, TextField } from '../workspaces/form-fields'
import { RetentionField } from '../workspaces/retention-field'
import { retentionChoice } from '../workspaces/workspace-form'
import { type RetentionValues, retentionSchema, toRetentionPatch } from './defaults-form'
import { useSaveDefaults } from './queries'
import { SaveState } from './save-state'
import { SectionHeader, SettingsCard } from './section-header'

// « Rétention » section (#43, D49): default retention of messages and logs, and the message
// quota of the workspace (the oldest go first beyond it), with the current fill.
export function RetentionSection({ page }: Readonly<{ page: SettingsPage }>) {
  const { t, i18n } = useLingui()
  const { workspace } = page
  const save = useSaveDefaults(workspace.slug)
  const defaultValues: RetentionValues = {
    retention: retentionChoice(workspace.retentionSeconds),
    maxMessages: workspace.maxMessages === null ? '' : String(workspace.maxMessages),
  }
  const schema = retentionSchema({
    number: t`A whole number above 0, or empty.`,
    sum: '',
    latency: '',
  })
  const form = useForm({
    defaultValues,
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: ({ value }) => save.mutateAsync(toRetentionPatch(value)),
  })
  const quota = workspace.maxMessages
  const used = i18n.number(workspace.messageCount)
  const total = quota === null ? '' : i18n.number(quota)
  const fill = quota ? Math.min(100, (workspace.messageCount / quota) * 100) : 0

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <SectionHeader
        title={<Trans>Retention</Trans>}
        description={<Trans>Older messages and logs are purged automatically.</Trans>}
      />
      <SettingsCard className="flex flex-wrap gap-[31px]">
        <form.Field name="retention">
          {(field) => <RetentionField value={field.state.value} onChange={field.handleChange} />}
        </form.Field>
        <div className="flex flex-col gap-2.5">
          <form.Field name="maxMessages">
            {(field) => (
              <TextField
                label={<Trans>Maximum messages</Trans>}
                name={field.name}
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
                error={firstError(field.state.meta.errors)}
                placeholder={t`unbounded`}
                inputMode="numeric"
                suffix={t`oldest first beyond`}
                mono
              />
            )}
          </form.Field>
          {quota !== null && (
            // Visual only: the count is written out below.
            <div
              aria-hidden
              className="h-1 w-[220px] overflow-hidden rounded-xs bg-ms-border-strong"
            >
              <div className="h-full bg-ms-accent" style={{ width: `${fill}%` }} />
            </div>
          )}
          <span className="font-mono text-label text-ms-text-faint">
            {quota === null ? (
              <Trans>{used} messages kept</Trans>
            ) : (
              <Trans>
                {used} / {total} used
              </Trans>
            )}
          </span>
        </div>
      </SettingsCard>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => <SaveState pending={pending} saved={save.isSuccess} failed={save.isError} />}
      </form.Subscribe>
    </form>
  )
}
