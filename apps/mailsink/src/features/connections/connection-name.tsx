import { Trans, useLingui } from '@lingui/react/macro'
import { Button } from '@mailsink/ui'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import type { ConnectionRow } from '../../server-fns/connections-types'
import { firstError, TextField } from '../workspaces/form-fields'
import { useConnectionMutations } from './queries'

// Name of an existing connection, renamed in place: « Save » appears once it changed.
export function ConnectionName({
  slug,
  connection,
}: Readonly<{ slug: string; connection: ConnectionRow }>) {
  const { t } = useLingui()
  const { update } = useConnectionMutations(slug)
  const schema = z.object({
    name: z.string().trim().min(1, t`Give it a name.`).max(80, t`80 characters at most.`),
  })
  const form = useForm({
    defaultValues: { name: connection.name },
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      await update.mutateAsync({ id: connection.id, patch: { name: value.name } })
      formApi.reset({ name: value.name.trim() })
    },
  })

  return (
    <form
      noValidate
      className="flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <div className="min-w-0 flex-1">
        <form.Field name="name">
          {(field) => (
            <TextField
              label={<Trans>Name</Trans>}
              name={field.name}
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              error={firstError(field.state.meta.errors)}
              mono
            />
          )}
        </form.Field>
      </div>
      <form.Subscribe selector={(state) => [state.isDirty, state.isSubmitting] as const}>
        {([dirty, submitting]) =>
          dirty && (
            <Button type="submit" disabled={submitting} className="mb-px">
              <Trans>Save</Trans>
            </Button>
          )
        }
      </form.Subscribe>
    </form>
  )
}
