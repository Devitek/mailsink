import { Trans, useLingui } from '@lingui/react/macro'
import type { TemplateView } from '@mailsink/contracts'
import { Button, DialogBody, DialogClose, DialogFooter } from '@mailsink/ui'
import { useForm, useStore } from '@tanstack/react-form'
import { type ReactNode, useState } from 'react'
import { firstError, TextField } from '../workspaces/form-fields'
import { useTemplateMutations } from './queries'
import {
  templateDefaults,
  templateSchema,
  templateValues,
  toTemplateInput,
  toTemplatePatch,
} from './template-form'
import { TemplatePreview } from './template-preview'
import { TextareaField } from './textarea-field'

type TemplateFormProps = { slug: string; template?: TemplateView; onDone: () => void }
type Meta = { isTouched: boolean; errors: readonly unknown[] }

// Template form (#43): TanStack Form with the Zod schema of template-form.ts; a taken id or
// a body left empty, refused by the server, shows on its field.
export function TemplateForm({ slug, template, onDone }: TemplateFormProps) {
  const { t } = useLingui()
  const { create, update } = useTemplateMutations(slug)
  const [serverIssues, setServerIssues] = useState<Record<string, string>>({})
  const [failed, setFailed] = useState(false)
  const schema = templateSchema({
    required: t`Give it a name.`,
    body: t`An HTML or a text body is required.`,
    id: t`A whole number above 0.`,
    sender: t`An address such as Shop <shop@example.test>.`,
  })
  const form = useForm({
    defaultValues: template ? templateValues(template) : templateDefaults(),
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: async ({ value }) => {
      setServerIssues({})
      setFailed(false)
      try {
        const saved = template
          ? await update.mutateAsync({
              externalId: template.externalId,
              patch: toTemplatePatch(value),
            })
          : await create.mutateAsync(toTemplateInput(value))
        if (saved.ok) return onDone()
        const issues: Record<string, string> = {}
        for (const issue of saved.issues) {
          issues[issue.path || 'form'] =
            issue.code === 'conflict' ? t`This id is already used in the workspace.` : issue.message
        }
        setServerIssues(issues)
      } catch {
        setFailed(true)
      }
    },
  })
  const values = useStore(form.store, (state) => state.values)
  const attempted = useStore(form.store, (state) => state.submissionAttempts > 0)
  const errorOf = (name: string, meta: Meta) =>
    serverIssues[name] ?? (meta.isTouched || attempted ? firstError(meta.errors) : undefined)

  const text = (name: 'externalId' | 'name' | 'subject' | 'sender', label: ReactNode) => (
    <form.Field name={name}>
      {(field) => (
        <TextField
          label={label}
          name={field.name}
          value={field.state.value}
          onChange={field.handleChange}
          onBlur={field.handleBlur}
          error={errorOf(name, field.state.meta)}
          placeholder={name === 'externalId' ? t`next free id` : undefined}
          inputMode={name === 'externalId' ? 'numeric' : undefined}
          mono={name !== 'name'}
        />
      )}
    </form.Field>
  )
  const body = (name: 'html' | 'text', label: ReactNode) => (
    <form.Field name={name}>
      {(field) => (
        <TextareaField
          label={label}
          name={field.name}
          value={field.state.value}
          onChange={field.handleChange}
          error={errorOf(name, field.state.meta)}
          rows={name === 'html' ? 10 : 5}
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
    >
      <DialogBody className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-[18px]">
          <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-[13px]">
            {template ? (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-ms-text-muted">ID</span>
                <span className="flex h-control-md items-center font-mono text-sm">
                  {template.externalId}
                </span>
              </div>
            ) : (
              text('externalId', 'ID')
            )}
            {text('name', <Trans>Name</Trans>)}
          </div>
          {text('subject', <Trans>Subject</Trans>)}
          {text('sender', <Trans>Default sender</Trans>)}
          {body('html', 'HTML')}
          {body('text', <Trans>Plain text</Trans>)}
          {(serverIssues.form || failed) && (
            <p role="alert" className="text-sm text-ms-danger">
              {serverIssues.form ?? <Trans>The template could not be saved. Try again.</Trans>}
            </p>
          )}
        </div>
        <TemplatePreview
          slug={slug}
          subject={values.subject}
          html={values.html}
          text={values.text}
        />
      </DialogBody>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>
          <Trans>Cancel</Trans>
        </DialogClose>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <Button type="submit" variant="primary" disabled={submitting}>
              {template ? <Trans>Save</Trans> : <Trans>Create the template</Trans>}
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  )
}
