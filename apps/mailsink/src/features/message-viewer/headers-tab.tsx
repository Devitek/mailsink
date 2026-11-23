import { Trans, useLingui } from '@lingui/react/macro'
import { Button, buttonVariants } from '@mailsink/ui'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { ViewerMessage } from '../../server-fns/messages-types'
import { formatBytes } from '../inbox/format-relative'
import { rawSourceQuery } from '../inbox/queries'
import { SectionTitle } from './links-tab'

// Stored headers of the message, then its raw MIME source (EML, D9): read when the tab is
// opened, cut beyond 512 KB in the page, complete in the download.
export function HeadersTab({ slug, message }: Readonly<{ slug: string; message: ViewerMessage }>) {
  const { t, i18n } = useLingui()
  const { data: raw, isPending } = useQuery(rawSourceQuery(slug, message.id))
  const [copied, setCopied] = useState(false)
  const headers = Object.entries(message.headers)
  const copy = async () => {
    if (!raw) return
    await navigator.clipboard.writeText(raw.text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2_000)
  }
  return (
    <div className="flex flex-col gap-[26px] px-[30px] py-6">
      <section>
        <SectionTitle>
          <Trans>Headers · {headers.length}</Trans>
        </SectionTitle>
        <dl className="m-0 overflow-hidden rounded-md border border-ms-border bg-ms-panel">
          {headers.map(([name, value]) => (
            <div
              key={name}
              className="grid grid-cols-[minmax(120px,210px)_minmax(0,1fr)] gap-4 border-b border-ms-border px-4 py-2 font-mono text-xs leading-normal last:border-b-0"
            >
              <dt className="text-ms-accent-text">{name}</dt>
              <dd className="m-0 break-all">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
          <SectionTitle>
            <Trans>MIME source (EML)</Trans>
          </SectionTitle>
          <div className="ml-auto flex gap-2">
            <Button size="sm" onClick={copy} disabled={!raw}>
              {copied ? <Trans>Copied</Trans> : <Trans>Copy</Trans>}
            </Button>
            <a href={message.rawUrl} download className={buttonVariants({ size: 'sm' })}>
              <Trans>Download .eml</Trans>
            </a>
          </div>
        </div>
        {raw?.truncated && (
          <p className="mb-2 text-xs text-ms-text-faint">
            <Trans>
              First 512 KB of {formatBytes(raw.sizeBytes, i18n.locale)}: download the file for the
              whole source.
            </Trans>
          </p>
        )}
        <pre className="m-0 max-h-[440px] overflow-auto rounded-md border border-ms-border bg-ms-bg px-[22px] py-[19px] font-mono text-xs leading-[1.65] break-all whitespace-pre-wrap text-ms-text-muted">
          {isPending ? t`Loading…` : (raw?.text ?? t`No MIME source was kept for this message.`)}
        </pre>
      </section>
    </div>
  )
}
