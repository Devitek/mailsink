import { Trans, useLingui } from '@lingui/react/macro'
import { Button, buttonVariants } from '@mailsink/ui'
import type { ReactNode } from 'react'
import type { ViewerMessage } from '../../server-fns/messages-types'
import { formatBytes } from '../inbox/format-relative'
import { useSimulate } from './use-simulate'

export function SectionTitle({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <h3 className="mb-2.5 text-label font-medium tracking-[0.06em] text-ms-text-faint uppercase">
      {children}
    </h3>
  )
}

const extension = (name: string | null) => name?.split('.').pop()?.slice(0, 4).toUpperCase() ?? '?'

// Links found in the HTML (click simulation per link, or open it outside the app) and the
// attachments (downloads through the session route).
export function LinksTab({ slug, message }: Readonly<{ slug: string; message: ViewerMessage }>) {
  const { t, i18n } = useLingui()
  const { simulate, pending, feedback, failed } = useSimulate(slug, message.id)
  const files = message.attachments.filter((a) => !a.inline)
  return (
    <div className="flex max-w-[900px] flex-col gap-[29px] px-[30px] py-6">
      <section>
        <SectionTitle>
          <Trans>Links found · {message.links.length}</Trans>
        </SectionTitle>
        {message.links.length === 0 ? (
          <p className="rounded-md border border-dashed border-ms-border-strong p-[19px] text-sm text-ms-text-faint">
            <Trans>No link.</Trans>
          </p>
        ) : (
          <ol className="overflow-hidden rounded-md border border-ms-border">
            {message.links.map((link, index) => (
              <li
                key={link.url}
                className="flex items-center gap-4 border-b border-ms-border bg-ms-panel px-4 py-3 last:border-b-0"
              >
                <span className="w-[18px] font-mono text-label text-ms-text-faint">
                  {index + 1}
                </span>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={link.text}
                  className="min-w-0 flex-1 truncate font-mono text-xs hover:underline"
                >
                  {link.url}
                </a>
                <Button
                  size="sm"
                  disabled={pending}
                  aria-label={t`Simulate a click on ${link.url}`}
                  onClick={() => simulate({ type: 'clicked', url: link.url })}
                >
                  <Trans>Simulate click</Trans>
                </Button>
              </li>
            ))}
          </ol>
        )}
        {feedback && (
          <output
            aria-live="polite"
            className={failed ? 'text-sm text-ms-danger' : 'text-sm text-ms-text-faint'}
          >
            {feedback}
          </output>
        )}
      </section>
      <section>
        <SectionTitle>
          <Trans>Attachments · {files.length}</Trans>
        </SectionTitle>
        {files.length === 0 ? (
          <p className="rounded-md border border-dashed border-ms-border-strong p-[19px] text-sm text-ms-text-faint">
            <Trans>No attachment.</Trans>
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2.5">
            {files.map((file) => (
              <li
                key={file.id}
                className="flex min-w-[260px] items-center gap-[13px] rounded-md border border-ms-border bg-ms-panel px-4 py-3.5"
              >
                <span className="grid h-9 w-[30px] place-items-center rounded-xs border border-ms-border-strong bg-ms-raised font-mono text-[8.5px] font-semibold text-ms-text-muted">
                  {extension(file.filename)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-xs">
                    {file.filename ?? file.id}
                  </span>
                  <span className="block text-[11.5px] text-ms-text-faint">
                    {file.contentType} · {formatBytes(file.sizeBytes, i18n.locale)}
                  </span>
                </span>
                <a
                  href={file.downloadUrl}
                  download={file.filename ?? true}
                  className={buttonVariants({ size: 'sm' })}
                >
                  <Trans>Download</Trans>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
