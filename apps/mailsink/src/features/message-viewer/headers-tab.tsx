import { Trans } from '@lingui/react/macro'
import type { ViewerMessage } from '../../server-fns/messages-types'
import { SectionTitle } from './links-tab'
import { SourcePanel } from './source-panel'

// Stored headers of the message, then where it came from: the request payload (or SMTP
// envelope) and the raw MIME source.
export function HeadersTab({ slug, message }: Readonly<{ slug: string; message: ViewerMessage }>) {
  const headers = Object.entries(message.headers)
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
      <SourcePanel slug={slug} message={message} />
    </div>
  )
}
