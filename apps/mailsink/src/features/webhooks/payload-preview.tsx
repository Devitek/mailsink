import { Trans, useLingui } from '@lingui/react/macro'
import type { CanonicalEvent, PayloadFormat } from '@mailsink/contracts'
import { Select } from '@mailsink/ui'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { EventCatalog } from '../../server-fns/settings-types'
import { previewEndpointFn } from '../../server-fns/webhooks-fns'
import { isChoiceOn } from './endpoint-form'

type PayloadPreviewProps = {
  slug: string
  catalog: EventCatalog
  format: PayloadFormat
  connectionId: string
  events: CanonicalEvent[]
}

// Live preview of what the endpoint will receive (D140): body and headers of the real
// formatter for one sample event, through the preview service; the signature and auth
// values are masked (the preview signs with a throwaway secret).
export function PayloadPreview({
  slug,
  catalog,
  format,
  connectionId,
  events,
}: PayloadPreviewProps) {
  const { t } = useLingui()
  const choices = catalog[format].filter((choice) => isChoiceOn(events, choice))
  const [picked, setPicked] = useState<string>()
  const event = choices.find((c) => c.name === picked)?.name ?? choices[0]?.name
  const preview = useQuery({
    queryKey: ['webhook-preview', slug, format, connectionId, event],
    queryFn: () =>
      previewEndpointFn({
        data: {
          slug,
          preview: {
            payloadFormat: format,
            event: event ?? '',
            ...(connectionId ? { connectionId } : {}),
          },
        },
      }),
    enabled: event !== undefined,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
  const headers = Object.entries(preview.data?.headers ?? {})
  const body = preview.data ? prettyJson(preview.data.body) : ''

  return (
    <section aria-label={t`Payload preview`} className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-ms-text-muted">
          <Trans>Preview</Trans>
        </span>
        {choices.length > 0 && event && (
          <Select
            aria-label={t`Preview event`}
            options={choices.map((c) => ({ value: c.name, label: c.name }))}
            value={event}
            onValueChange={setPicked}
            mono
          />
        )}
      </div>
      {event === undefined ? (
        <p className="text-xs text-ms-text-faint">
          <Trans>Choose an event this format can send to preview its payload.</Trans>
        </p>
      ) : preview.isError ? (
        <p role="alert" className="text-xs text-ms-danger">
          <Trans>The preview is not available.</Trans>
        </p>
      ) : (
        <>
          <dl
            data-testid="preview-headers"
            className="m-0 rounded-md border border-ms-border bg-ms-bg px-4 py-3 font-mono text-label leading-[1.7]"
          >
            {headers.map(([name, value]) => (
              <div key={name} className="flex gap-2 break-all">
                <dt className="shrink-0 text-ms-accent-text">{name}:</dt>
                <dd className="m-0 text-ms-text-muted">{value}</dd>
              </div>
            ))}
          </dl>
          <pre
            data-testid="preview-body"
            className="m-0 max-h-[340px] overflow-auto rounded-md border border-ms-border bg-ms-bg px-4 py-3 font-mono text-label leading-[1.6] whitespace-pre-wrap break-all text-ms-text-muted"
          >
            {body}
          </pre>
        </>
      )}
    </section>
  )
}

function prettyJson(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
  }
}
