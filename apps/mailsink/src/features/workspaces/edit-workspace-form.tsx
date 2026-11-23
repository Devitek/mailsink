import { Trans, useLingui } from '@lingui/react/macro'
import { DialogBody, DialogDescription, DialogHeader, DialogTitle } from '@mailsink/ui'
import { useForm, useStore } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import type { WorkspaceSettings } from '../../server-fns/connections-types'
import { updateWorkspaceFn } from '../../server-fns/workspaces-manage-fns'
import { firstError, TextField } from './form-fields'
import { DialogFormFooter, FormFailure } from './form-parts'
import { type EditWorkspaceValues, editWorkspaceSchema, toUpdateRequest } from './workspace-form'

const touchedError = (meta: { isTouched: boolean; errors: readonly unknown[] }) =>
  meta.isTouched ? firstError(meta.errors) : undefined

// Identity of a workspace (#38): name and description. The slug stays: it is in every URL,
// snippet and CI configuration. The defaults (retention, quota, rate limit, simulation)
// are edited in one place, the settings page, linked from here.
export function EditWorkspaceForm({
  workspace,
  onSaved,
}: Readonly<{ workspace: WorkspaceSettings; onSaved: () => void }>) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const [failed, setFailed] = useState(false)
  const slug = workspace.slug
  const defaultValues: EditWorkspaceValues = {
    name: workspace.name,
    description: workspace.description ?? '',
  }
  const schema = editWorkspaceSchema({ nameRequired: t`Give it a name.` })
  const form = useForm({
    defaultValues,
    validators: { onBlur: schema, onSubmit: schema },
    onSubmit: async ({ value }) => {
      setFailed(false)
      try {
        await updateWorkspaceFn({ data: { slug, patch: toUpdateRequest(value) } })
      } catch {
        setFailed(true)
        return
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['connections', slug] }),
        queryClient.invalidateQueries({ queryKey: ['workspace', slug] }),
        queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
      ])
      onSaved()
    },
  })
  const submitting = useStore(form.store, (state) => state.isSubmitting)

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <DialogHeader>
        <DialogTitle>
          <Trans>Edit the workspace</Trans>
        </DialogTitle>
        <DialogDescription>
          <Trans>The slug /w/{slug} does not change.</Trans>
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        <form.Field name="name">
          {(field) => (
            <TextField
              label={<Trans>Name</Trans>}
              name={field.name}
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              error={touchedError(field.state.meta)}
            />
          )}
        </form.Field>
        <form.Field name="description">
          {(field) => (
            <TextField
              label={<Trans>Description</Trans>}
              name={field.name}
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              error={touchedError(field.state.meta)}
            />
          )}
        </form.Field>
        <p className="text-sm text-ms-text-muted">
          <Trans>
            Retention, message quota, rate limit and simulation are workspace defaults:{' '}
            <Link
              to="/w/$workspaceSlug/settings"
              params={{ workspaceSlug: slug }}
              search={{ section: 'retention' }}
              onClick={onSaved}
              className="text-ms-accent-text underline-offset-4 hover:underline"
            >
              edit them in the settings
            </Link>
            .
          </Trans>
        </p>
        {failed && (
          <FormFailure>
            <Trans>The workspace could not be saved. Try again.</Trans>
          </FormFailure>
        )}
      </DialogBody>
      <DialogFormFooter submitting={submitting}>
        <Trans>Save</Trans>
      </DialogFormFooter>
    </form>
  )
}
