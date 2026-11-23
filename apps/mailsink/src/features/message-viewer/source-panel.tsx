import { Trans, useLingui } from '@lingui/react/macro'
import { buttonVariants, SegmentedControl } from '@mailsink/ui'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import type { MessageOrigin, ViewerMessage } from '../../server-fns/messages-types'
import { connectionOf } from '../inbox/connection-label'
import { formatBytes } from '../inbox/format-relative'
import { messageOriginQuery, rawSourceQuery } from '../inbox/queries'
import { CopyButton } from '../shell/copy-button'
import { SectionTitle } from './links-tab'

type View = 'payload' | 'eml'

const pre =
  'm-0 max-h-[440px] overflow-auto rounded-md border border-ms-border bg-ms-bg px-[22px] py-[19px] font-mono text-xs leading-[1.65] break-all whitespace-pre-wrap text-ms-text-muted'

function originText(origin: MessageOrigin): string {
  if (origin.kind === 'smtp') return `${origin.sessionId}\n\n${origin.envelope.join('\n')}`
  const request = `${origin.method} ${origin.path} → ${origin.statusCode} · ${origin.logId}`
  return `${request}\n\n${origin.body ?? ''}`
}

// « Payload Resend / Source EML » of the prototype (Headers & MIME tab): the logged request
// that created the message (or its SMTP envelope), linked to the logs explorer, and the raw
// MIME source (EML, D9), cut beyond 512 KB in the page, complete in the download.
export function SourcePanel({ slug, message }: Readonly<{ slug: string; message: ViewerMessage }>) {
  const { t, i18n } = useLingui()
  const [view, setView] = useState<View>('payload')
  const raw = useQuery({ ...rawSourceQuery(slug, message.id), enabled: view === 'eml' })
  const origin = useQuery({ ...messageOriginQuery(slug, message.id), enabled: view === 'payload' })
  const smtp = message.source === 'smtp'
  const payloadLabel = smtp ? t`SMTP envelope` : t`Payload ${connectionOf(message, []).label}`

  const text =
    view === 'eml'
      ? raw.isPending
        ? t`Loading…`
        : (raw.data?.text ?? t`No MIME source was kept for this message.`)
      : origin.isPending
        ? t`Loading…`
        : origin.data
          ? originText(origin.data)
          : t`No log holds this message any more (retention or purge).`
  const payload = origin.data
    ? origin.data.kind === 'api'
      ? (origin.data.body ?? undefined)
      : origin.data.envelope.join('\n')
    : undefined
  const copyable = view === 'eml' ? raw.data?.text : payload

  return (
    <section>
      <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
        <SectionTitle>
          <Trans>Source</Trans>
        </SectionTitle>
        <SegmentedControl
          aria-label={t`Source view`}
          value={view}
          onValueChange={setView}
          options={[
            { value: 'payload', label: payloadLabel },
            { value: 'eml', label: t`EML source` },
          ]}
          fill
        />
        <div className="ml-auto flex gap-2">
          <CopyButton value={copyable ?? ''} size="sm" disabled={!copyable} />
          {view === 'eml' ? (
            <a href={message.rawUrl} download className={buttonVariants({ size: 'sm' })}>
              <Trans>Download .eml</Trans>
            </a>
          ) : (
            origin.data && (
              <Link
                to="/w/$workspaceSlug/logs"
                params={{ workspaceSlug: slug }}
                search={
                  origin.data.kind === 'api'
                    ? { inspect: origin.data.logId }
                    : { tab: 'smtp', inspect: origin.data.sessionId }
                }
                className={buttonVariants({ size: 'sm' })}
              >
                <Trans>See in the logs →</Trans>
              </Link>
            )
          )}
        </div>
      </div>
      {view === 'eml' && raw.data?.truncated && (
        <p className="mb-2 text-xs text-ms-text-faint">
          <Trans>
            First 512 KB of {formatBytes(raw.data.sizeBytes, i18n.locale)}: download the file for
            the whole source.
          </Trans>
        </p>
      )}
      <pre className={pre}>{text}</pre>
    </section>
  )
}
