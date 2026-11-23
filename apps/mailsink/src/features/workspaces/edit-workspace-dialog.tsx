import { Trans, useLingui } from '@lingui/react/macro'
import {
  Button,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@mailsink/ui'
import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { WorkspaceSettings } from '../../server-fns/connections-types'
import { updateWorkspaceFn } from '../../server-fns/workspaces-manage-fns'
import { firstError, TextField } from './form-fields'
import { RetentionField } from './retention-field'
import {
  type EditWorkspaceValues,
  editWorkspaceSchema,
  rateLimitText,
  retentionChoice,
  toUpdateRequest,
} from './workspace-form'

// « Edit » of the workspace card (#38): name, description, default retention and rate
// limit. The slug stays: it is in every URL, snippet and CI configuration.
export function EditWorkspaceDialog({ workspace }: Readonly<{ workspace: WorkspaceSettings }>) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
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
      setOpen(false)
    },
  })

  const touchedError = (meta: { isTouched: boolean; errors: readonly unknown[] }) =>
    meta.isTouched ? firstError(meta.errors) : undefined

  return (
    <Dialog
      open={open}
      onOpenChange={(next: boolean) => {
        setOpen(next)
        if (next) form.reset(defaultValues)
      }}
    >
      <DialogTrigger render={<Button />}>
        <Trans>Edit</Trans>
      </DialogTrigger>
      <DialogContent>
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
                {(field) => (
                  <RetentionField value={field.state.value} onChange={field.handleChange} />
                )}
              </form.Field>
              <form.Field name="rateLimit">
                {(field) => (
                  <TextField
                    label={<Trans>Default rate limit</Trans>}
                    name={field.name}
                    value={field.state.value}
                    onChange={field.handleChange}
                    onBlur={field.handleBlur}
                    error={touchedError(field.state.meta)}
                    placeholder={t`unlimited`}
                    inputMode="numeric"
                    suffix="req/s"
                    mono
                  />
                )}
              </form.Field>
            </div>
            {failed && (
              <p role="alert" className="text-sm text-ms-danger">
                <Trans>The workspace could not be saved. Try again.</Trans>
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              <Trans>Cancel</Trans>
            </DialogClose>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(submitting) => (
                <Button type="submit" variant="primary" disabled={submitting}>
                  <Trans>Save</Trans>
                </Button>
              )}
            </form.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
