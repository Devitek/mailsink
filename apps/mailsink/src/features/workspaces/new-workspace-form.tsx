import { Trans, useLingui } from '@lingui/react/macro'
import { type ConnectionKind, slugify } from '@mailsink/contracts'
import {
  Button,
  DialogBody,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  SegmentedControl,
  Switch,
} from '@mailsink/ui'
import { useForm } from '@tanstack/react-form'
import { useId, useRef, useState } from 'react'
import type { CreatedWorkspace } from '../../server-fns/connections-types'
import { createWorkspaceFn } from '../../server-fns/workspaces-manage-fns'
import { KIND_OPTIONS } from '../connections/kinds'
import { EphemeralHint } from './ephemeral-hint'
import { firstError, TextField } from './form-fields'
import { RetentionField } from './retention-field'
import { newWorkspaceDefaults, newWorkspaceSchema, toCreateRequest } from './workspace-form'

// First step of « Nouveau workspace persistant » (prototype): name, slug derived from the
// name until edited, default retention and rate limit, optional first connection.
export function NewWorkspaceForm({
  onCreated,
}: Readonly<{ onCreated: (workspace: CreatedWorkspace) => void }>) {
  const { t } = useLingui()
  const switchId = useId()
  const slugEdited = useRef(false)
  const [slugTaken, setSlugTaken] = useState(false)
  const [failed, setFailed] = useState(false)
  const schema = newWorkspaceSchema({
    nameRequired: t`Give it a name.`,
    slugInvalid: t`2 to 63 lower-case letters, digits or dashes, starting with a letter or digit.`,
    rateInvalid: t`A whole number of requests per second, or empty.`,
  })
  const form = useForm({
    defaultValues: newWorkspaceDefaults,
    validators: { onBlur: schema, onSubmit: schema },
    onSubmit: async ({ value }) => {
      setFailed(false)
      try {
        const result = await createWorkspaceFn({ data: toCreateRequest(value) })
        if (result.ok) onCreated(result)
        else setSlugTaken(true)
      } catch {
        setFailed(true)
      }
    },
  })
  const shown = (meta: { isTouched: boolean; errors: readonly unknown[] }) =>
    meta.isTouched ? firstError(meta.errors) : undefined

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
          <Trans>New persistent workspace</Trans>
        </DialogTitle>
        <DialogDescription>
          <Trans>For staging / QA. Ephemeral workspaces are created through the Admin API.</Trans>
        </DialogDescription>
      </DialogHeader>
      <DialogBody>
        <form.Field
          name="name"
          listeners={{
            onChange: ({ value }) => {
              if (slugEdited.current) return
              setSlugTaken(false)
              form.setFieldValue('slug', value.trim() ? slugify(value) : '')
            },
          }}
        >
          {(field) => (
            <TextField
              label={<Trans>Name</Trans>}
              name={field.name}
              value={field.state.value}
              onChange={field.handleChange}
              onBlur={field.handleBlur}
              error={shown(field.state.meta)}
              placeholder={t`Billing Service - Staging`}
              autoFocus
            />
          )}
        </form.Field>
        <form.Field name="slug">
          {(field) => (
            <TextField
              label={<Trans>Slug</Trans>}
              name={field.name}
              value={field.state.value}
              onChange={(value) => {
                slugEdited.current = true
                setSlugTaken(false)
                field.handleChange(value.toLowerCase())
              }}
              onBlur={field.handleBlur}
              error={slugTaken ? t`This slug is already taken.` : shown(field.state.meta)}
              placeholder="billing-service-staging"
              prefix="/w/"
              mono
            />
          )}
        </form.Field>
        <div className="flex flex-wrap gap-[21px]">
          <form.Field name="retention">
            {(field) => <RetentionField value={field.state.value} onChange={field.handleChange} />}
          </form.Field>
          <form.Field name="rateLimit">
            {(field) => (
              <TextField
                label={<Trans>Default rate limit</Trans>}
                name={field.name}
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
                error={shown(field.state.meta)}
                placeholder={t`unlimited`}
                inputMode="numeric"
                suffix="req/s"
                mono
              />
            )}
          </form.Field>
        </div>
        <div className="flex flex-col gap-[13px] rounded-md border border-ms-border p-4">
          <form.Field name="withConnection">
            {(field) => (
              <label htmlFor={switchId} className="flex items-center gap-[13px] text-sm">
                <Switch
                  id={switchId}
                  checked={field.state.value}
                  onCheckedChange={(on: boolean) => field.handleChange(on)}
                />
                <Trans>Add a first connection</Trans>
              </label>
            )}
          </form.Field>
          <form.Subscribe selector={(state) => state.values.withConnection}>
            {(withConnection) =>
              withConnection && (
                <form.Field name="kind">
                  {(field) => (
                    <SegmentedControl
                      aria-label={t`Connection kind`}
                      options={KIND_OPTIONS}
                      value={field.state.value}
                      onValueChange={(kind: ConnectionKind) => field.handleChange(kind)}
                    />
                  )}
                </form.Field>
              )
            }
          </form.Subscribe>
        </div>
        <EphemeralHint />
        {failed && (
          <p role="alert" className="text-sm text-ms-danger">
            <Trans>The workspace could not be created. Try again.</Trans>
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
              <Trans>Create the workspace</Trans>
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  )
}
