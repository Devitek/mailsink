import { Trans, useLingui } from '@lingui/react/macro'
import type { WebhookEndpointWithSecret } from '@mailsink/contracts'
import { Button, DialogBody, DialogClose, DialogFooter } from '@mailsink/ui'
import { useForm, useStore } from '@tanstack/react-form'
import { useId, useState } from 'react'
import type { SettingsPage } from '../../server-fns/settings-types'
import type { EndpointRow, FieldIssue } from '../../server-fns/webhooks-types'
import { TextField } from '../workspaces/form-fields'
import { BrevoAuthFields } from './brevo-auth-fields'
import { CustomHeadersField } from './custom-headers-field'
import {
  endpointDefaults,
  endpointSchema,
  endpointValues,
  formatForScope,
  toEndpointInput,
  toEndpointPatch,
} from './endpoint-form'
import { EventPicker } from './event-picker'
import { PayloadPreview } from './payload-preview'
import { useEndpointMutations } from './queries'
import { ScopeFormatFields } from './scope-format-fields'

type EndpointFormProps = {
  page: SettingsPage
  endpoint?: EndpointRow
  onDone: (endpoint: WebhookEndpointWithSecret) => void
}

// Endpoint form (#43), TanStack Form state validated by the Zod schema of endpoint-form.ts
// once submitted, then refusals of the server (reserved header, private URL…) on their
// field. Changing the scope prefills the format until the user picks one by hand.
export function EndpointForm({ page, endpoint, onDone }: EndpointFormProps) {
  const { t } = useLingui()
  const eventsLabel = useId()
  const slug = page.workspace.slug
  const { create, update } = useEndpointMutations(slug)
  const [serverIssues, setServerIssues] = useState<FieldIssue[]>([])
  const [failed, setFailed] = useState(false)
  const schema = endpointSchema(
    {
      url: t`An http(s) URL.`,
      events: t`Choose at least one event.`,
      header: t`Invalid header name.`,
      required: t`Required.`,
    },
    endpoint?.brevoAuth ?? null,
  )
  const form = useForm({
    defaultValues: endpoint ? endpointValues(endpoint) : endpointDefaults(),
    onSubmit: async ({ value }) => {
      if (!schema.safeParse(value).success) return
      setServerIssues([])
      setFailed(false)
      try {
        const saved = endpoint
          ? await update.mutateAsync({ id: endpoint.id, patch: toEndpointPatch(value, endpoint) })
          : await create.mutateAsync(toEndpointInput(value))
        if (saved.ok) onDone(saved.endpoint)
        else setServerIssues(saved.issues)
      } catch {
        setFailed(true)
      }
    },
  })
  const values = useStore(form.store, (state) => state.values)
  const attempted = useStore(form.store, (state) => state.submissionAttempts > 0)
  const issues: Record<string, string> = {}
  if (attempted) {
    for (const issue of schema.safeParse(values).error?.issues ?? []) {
      issues[issue.path.join('.')] ??= issue.message
    }
  }
  for (const issue of serverIssues) issues[issue.path] ??= issue.message
  const headerErrors: Record<number, string> = {}
  values.customHeaders.forEach((_, i) => {
    const error = issues[`customHeaders.${i}.key`]
    if (error) headerErrors[i] = error
  })
  const brevo = values.payloadFormat === 'brevo'
  const general = serverIssues.filter(
    (i) => !['url', 'events', 'customHeaders'].includes(i.path.split('.')[0] ?? ''),
  )

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <DialogBody className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="flex min-w-0 flex-col gap-[18px]">
          <ScopeFormatFields
            connections={page.connections}
            connectionId={values.connectionId}
            format={values.payloadFormat}
            onScope={(id) => {
              form.setFieldValue('connectionId', id)
              if (!form.getFieldValue('formatEdited')) {
                form.setFieldValue('payloadFormat', formatForScope(page.connections, id))
              }
            }}
            onFormat={(format) => {
              form.setFieldValue('payloadFormat', format)
              form.setFieldValue('formatEdited', true)
            }}
          />
          <TextField
            label={<Trans>URL</Trans>}
            name="url"
            value={values.url}
            onChange={(v) => form.setFieldValue('url', v)}
            error={issues.url}
            placeholder="https://example.test/webhooks"
            mono
          />
          <TextField
            label={<Trans>Description</Trans>}
            name="description"
            value={values.description}
            onChange={(v) => form.setFieldValue('description', v)}
          />
          <div className="flex flex-col gap-2">
            <span id={eventsLabel} className="text-xs font-medium text-ms-text-muted">
              <Trans>Events</Trans>
            </span>
            <EventPicker
              labelId={eventsLabel}
              catalog={page.eventCatalog}
              format={values.payloadFormat}
              value={values.events}
              onChange={(events) => form.setFieldValue('events', events)}
            />
            {issues.events && <span className="text-xs text-ms-danger">{issues.events}</span>}
          </div>
          {brevo ? (
            <BrevoAuthFields
              values={values}
              onChange={(name, value) => form.setFieldValue(name, value as never)}
              errors={issues}
              stored={endpoint?.payloadFormat === 'brevo'}
            />
          ) : (
            <p className="text-xs text-ms-text-faint">
              {endpoint?.payloadFormat === 'brevo' || !endpoint ? (
                <Trans>A signing secret (whsec_…) is issued on save and shown on the card.</Trans>
              ) : (
                <Trans>The signing secret is kept: reveal or rotate it on the card.</Trans>
              )}
            </p>
          )}
          <CustomHeadersField
            value={values.customHeaders}
            onChange={(headers) => form.setFieldValue('customHeaders', headers)}
            errors={headerErrors}
          />
          {general.map((issue) => (
            <p key={issue.path + issue.code} role="alert" className="text-sm text-ms-danger">
              {issue.message}
            </p>
          ))}
          {failed && (
            <p role="alert" className="text-sm text-ms-danger">
              <Trans>The endpoint could not be saved. Try again.</Trans>
            </p>
          )}
        </div>
        <PayloadPreview
          slug={slug}
          catalog={page.eventCatalog}
          format={values.payloadFormat}
          connectionId={values.connectionId}
          events={values.events}
        />
      </DialogBody>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>
          <Trans>Cancel</Trans>
        </DialogClose>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <Button type="submit" variant="primary" disabled={submitting}>
              {endpoint ? <Trans>Save</Trans> : <Trans>Create the endpoint</Trans>}
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  )
}
