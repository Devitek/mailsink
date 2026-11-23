import { Trans, useLingui } from '@lingui/react/macro'
import type { InboxTab } from '@mailsink/contracts'
import type { InboxConnectionFacet } from '@mailsink/core'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@mailsink/ui'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { messageQuery } from '../inbox/queries'
import { HeadersTab } from './headers-tab'
import { HistoryTab } from './history-tab'
import { LinksTab } from './links-tab'
import { PreviewTab } from './preview-tab'
import { ViewerHeader } from './viewer-header'

// Message viewer (#40): header with the « Simulate » actions, then five tabs. The open
// message and the tab live in the URL (`?m=`, `?tab=`).
export function MessageViewer({
  slug,
  messageId,
  tab,
  onTabChange,
  connections,
  purge,
  back,
}: Readonly<{
  slug: string
  messageId: string
  tab: InboxTab
  onTabChange: (tab: InboxTab) => void
  connections: readonly InboxConnectionFacet[] | undefined
  /** The purge control of the header. */
  purge: ReactNode
  /** Back to the list on narrow screens. */
  back: ReactNode
}>) {
  const { t } = useLingui()
  const { data: message, isPending, isError } = useQuery(messageQuery(slug, messageId))
  if (isPending) {
    return (
      <p className="p-6 text-body text-ms-text-muted">
        <Trans>Loading message…</Trans>
      </p>
    )
  }
  if (isError || !message) {
    return (
      <div className="flex flex-col gap-3 p-6">
        {back}
        <p className="text-body text-ms-text-muted">
          <Trans>This message no longer exists. It may have been purged.</Trans>
        </p>
      </div>
    )
  }
  const tabs: { value: InboxTab; label: string; count?: number }[] = [
    { value: 'preview', label: t`Preview` },
    { value: 'text', label: t`Text` },
    {
      value: 'links',
      label: t`Links & attachments`,
      count: message.links.length + message.attachments.filter((a) => !a.inline).length,
    },
    { value: 'headers', label: t`Headers & MIME` },
    {
      value: 'history',
      label: t`History`,
      count: message.events.length + (message.webhookDeliveries?.length ?? 0),
    },
  ]
  return (
    <Tabs
      value={tab}
      onValueChange={(value) => onTabChange(value as InboxTab)}
      className="min-h-0 flex-1"
    >
      <div className="border-b border-ms-border bg-ms-panel px-6 pt-[19px]">
        {back}
        <ViewerHeader slug={slug} message={message} connections={connections} purge={purge} />
        <TabsList variant="line" className="-mx-1 w-full overflow-x-auto [scrollbar-width:none]">
          {tabs.map((item) => (
            <TabsTrigger key={item.value} value={item.value}>
              {item.label}
              {item.count ? (
                <span className="inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-ms-hover px-[5px] font-mono text-badge text-ms-text-muted">
                  {item.count}
                </span>
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <TabsContent value="preview" className="h-full">
          <PreviewTab slug={slug} message={message} onShowText={() => onTabChange('text')} />
        </TabsContent>
        <TabsContent value="text">
          {message.text ? (
            <pre className="m-0 px-[30px] py-[27px] font-mono text-sm leading-[1.7] whitespace-pre-wrap text-ms-text">
              {message.text}
            </pre>
          ) : (
            <p className="px-[30px] py-[27px] text-body text-ms-text-faint">
              <Trans>This message has no text body.</Trans>
            </p>
          )}
        </TabsContent>
        <TabsContent value="links">
          <LinksTab slug={slug} message={message} />
        </TabsContent>
        <TabsContent value="headers">
          <HeadersTab slug={slug} message={message} />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab slug={slug} message={message} />
        </TabsContent>
      </div>
    </Tabs>
  )
}
