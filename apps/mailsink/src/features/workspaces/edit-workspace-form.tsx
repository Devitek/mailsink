import { Trans, useLingui } from '@lingui/react/macro'
import { DialogBody, DialogDescription, DialogHeader, DialogTitle } from '@mailsink/ui'
import { useForm, useStore } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { WorkspaceSettings } from '../../server-fns/connections-types'
import { updateWorkspaceFn } from '../../server-fns/workspaces-manage-fns'
import { firstError, TextField } from './form-fields'
import { DialogFormFooter, FormFailure, RateLimitField } from './form-parts'
import { RetentionField } from './retention-field'
import {
  type EditWorkspaceValues,
  editWorkspaceSchema,
  rateLimitText,
  retentionChoice,
  toUpdateRequest,
} from './workspace-form'

const touchedError = (meta: { isTouched: boolean; errors: readonly unknown[] }) =>
  meta.isTouched ? firstError(meta.errors) : undefined

// Settings of a workspace (#38): name, description, default retention and rate limit. The
// slug stays: it is in every URL, snippet and CI configuration.
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
    retention: retentionChoice(workspace.retentionSeconds),
    rateLimit: rateLimitText(workspace.rateLimit),
  }
  const schema = editWorkspaceSchema({
    nameRequired: t`Give it a name.`,
    slugInvalid: '',
    rateInvalid: t`A whole number of requests per second, or empty.`,
  })
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
        <div className="flex flex-wrap gap-[21px]">
          <form.Field name="retention">
            {(field) => <RetentionField value={field.state.value} onChange={field.handleChange} />}
          </form.Field>
          <form.Field name="rateLimit">
            {(field) => (
              <RateLimitField
                name={field.name}
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
                error={touchedError(field.state.meta)}
              />
            )}
          </form.Field>
        </div>
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
