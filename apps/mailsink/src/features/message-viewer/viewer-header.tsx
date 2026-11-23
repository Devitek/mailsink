import { Trans, useLingui } from '@lingui/react/macro'
import type { AddressOut } from '@mailsink/contracts'
import type { InboxConnectionFacet } from '@mailsink/core'
import { cn, StatusBadge } from '@mailsink/ui'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import type { ViewerMessage } from '../../server-fns/messages-types'
import { connectionOf } from '../inbox/connection-label'
import { formatReceived } from '../inbox/format-relative'
import { SimulateBar } from './simulate-bar'

const address = (a: AddressOut) => (a.name ? `${a.name} <${a.email}>` : a.email)

function Meta({ label, children }: Readonly<{ label: ReactNode; children: ReactNode }>) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <dt className="w-[52px] shrink-0 text-ms-text-faint">{label}</dt>
      <dd className="m-0 flex min-w-0 items-center gap-2.5">{children}</dd>
    </div>
  )
}

// Viewer header of the prototype: status and id, subject, From / To / Source / Received,
// tags (a click filters the inbox by that tag), the « Simulate » bar.
export function ViewerHeader({
  slug,
  message,
  connections,
  purge,
}: Readonly<{
  slug: string
  message: ViewerMessage
  connections: readonly InboxConnectionFacet[] | undefined
  purge: ReactNode
}>) {
  const { t, i18n } = useLingui()
  const connection = connectionOf(message, connections)
  return (
    <>
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-[1_1_320px]">
          <div className="mb-2 flex items-center gap-2.5">
            <StatusBadge status={message.status} size="md" dot />
            <span className="font-mono text-[11.5px] text-ms-text-faint">{message.id}</span>
          </div>
          <h2 className="m-0 text-[18px] leading-[1.3] font-semibold tracking-[-0.015em] text-pretty">
            {message.subject || t`(no subject)`}
          </h2>
        </div>
        <div className="flex shrink-0 gap-2">{purge}</div>
      </div>
      <dl className="my-[13px] grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-x-[26px] gap-y-[5px] text-sm">
        <Meta label={<Trans>From</Trans>}>
          <span className="truncate">{address(message.from)}</span>
        </Meta>
        <Meta label={<Trans>To</Trans>}>
          <span className="truncate font-mono text-xs">
            {[...message.to, ...message.cc, ...message.bcc].map((a) => a.email).join(', ')}
          </span>
        </Meta>
        <Meta label={<Trans>Source</Trans>}>
          <span className={cn('font-medium', connection.className)}>{connection.label}</span>
          {connection.name && (
            <span className="truncate font-mono text-xs text-ms-text-muted">{connection.name}</span>
          )}
        </Meta>
        <Meta label={<Trans>Received</Trans>}>
          <time dateTime={message.createdAt} className="font-mono text-xs" suppressHydrationWarning>
            {formatReceived(message.createdAt, i18n.locale)}
          </time>
        </Meta>
      </dl>
      {message.tags.length > 0 && (
        <ul aria-label={t`Tags`} className="mb-[13px] flex flex-wrap gap-[5px]">
          {message.tags.map((tag) => {
            const value = `${tag.name}:${tag.value}`
            return (
              <li key={value}>
                <Link
                  to="/w/$workspaceSlug"
                  params={{ workspaceSlug: slug }}
                  search={(prev) => ({ ...prev, tag: value, m: undefined, tab: undefined })}
                  title={t`Show the messages tagged ${value}`}
                  className="inline-flex h-5 items-center overflow-hidden rounded-sm border border-ms-border-strong font-mono text-label outline-none hover:border-ms-accent-text focus-visible:focus-ring"
                >
                  <span className="flex h-full items-center bg-ms-raised px-2 text-ms-text-faint">
                    {tag.name}
                  </span>
                  <span className="px-2">{tag.value}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      <SimulateBar slug={slug} message={message} />
    </>
  )
}
