import { Trans, useLingui } from '@lingui/react/macro'
import { Input, SegmentedControl } from '@mailsink/ui'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useId, useState } from 'react'
import { previewTemplateFn } from '../../server-fns/templates-fns'
import { parseParams } from './template-form'
import { TextareaField } from './textarea-field'

type TemplatePreviewProps = { slug: string; subject: string; html: string; text: string }

const SAMPLE_PARAMS = '{\n  "name": "Julie"\n}'

function useDebounced<T>(value: T, ms = 300): T {
  const [current, setCurrent] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setCurrent(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return current
}

// Rendered preview of the template being edited (D203): the Brevo renderer of the server
// (D126) on the unsaved fields, with sample params and contact email. The HTML shows in a
// sandboxed frame without any allowance (no script, no form, no navigation).
export function TemplatePreview({ slug, subject, html, text }: TemplatePreviewProps) {
  const { t } = useLingui()
  const emailId = useId()
  const [paramsText, setParamsText] = useState(SAMPLE_PARAMS)
  const [email, setEmail] = useState('julie@example.test')
  const [tab, setTab] = useState<'html' | 'text'>('html')
  const parsed = parseParams(paramsText)
  // Debounced as one string: a fresh object every render would never settle.
  const input = JSON.parse(
    useDebounced(JSON.stringify({ subject, html, text, paramsText, email })),
  ) as { subject: string; html: string; text: string; paramsText: string; email: string }
  const params = parseParams(input.paramsText)
  const preview = useQuery({
    queryKey: ['template-preview', slug, input],
    queryFn: () =>
      previewTemplateFn({
        data: {
          slug,
          subject: input.subject,
          html: input.html,
          text: input.text,
          params: params.ok ? params.params : {},
          contactEmail: input.email,
        },
      }),
    enabled: params.ok,
    placeholderData: keepPreviousData,
  })
  const rendered = preview.data

  return (
    <section aria-label={t`Rendered preview`} className="flex min-w-0 flex-col gap-[13px]">
      <TextareaField
        label={<Trans>Sample params (JSON)</Trans>}
        name="params"
        value={paramsText}
        onChange={setParamsText}
        error={parsed.ok ? undefined : t`A JSON object, such as {"name": "Julie"}.`}
        rows={4}
      />
      <div className="flex flex-col gap-2">
        <label htmlFor={emailId} className="text-xs font-medium text-ms-text-muted">
          contact.EMAIL
        </label>
        <Input
          id={emailId}
          value={email}
          onValueChange={(v: string) => setEmail(v)}
          className="font-mono"
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-ms-text-muted">
          <Trans>Preview</Trans>
        </span>
        <SegmentedControl
          aria-label={t`Preview body`}
          options={[
            { value: 'html', label: 'HTML' },
            { value: 'text', label: t`Text` },
          ]}
          value={tab}
          onValueChange={setTab}
        />
      </div>
      <p data-testid="template-preview-subject" className="truncate text-sm font-semibold">
        {rendered?.subject || (
          <span className="font-normal text-ms-text-faint">
            <Trans>No subject</Trans>
          </span>
        )}
      </p>
      {tab === 'html' ? (
        <iframe
          title={t`Rendered HTML`}
          sandbox=""
          srcDoc={rendered?.html ?? ''}
          className="h-[360px] w-full rounded-md border border-ms-border bg-ms-bg"
        />
      ) : (
        <pre
          data-testid="template-preview-text"
          className="m-0 h-[360px] overflow-auto rounded-md border border-ms-border bg-ms-bg px-4 py-3 font-mono text-xs whitespace-pre-wrap text-ms-text-muted"
        >
          {rendered?.text}
        </pre>
      )}
    </section>
  )
}
