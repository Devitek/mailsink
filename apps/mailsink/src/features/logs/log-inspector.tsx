import { useLingui } from '@lingui/react/macro'
import type { LogsTab } from '@mailsink/contracts'
import { Sheet, SheetContent } from '@mailsink/ui'
import type { LogSources } from '../../server-fns/logs-types'
import { ApiInspector } from './api-inspector'
import { SmtpInspector } from './smtp-inspector'
import { WebhookInspector } from './webhook-inspector'

// Inspector `Sheet` of the logs explorer (#41): open while `?inspect=` names a row of the
// current tab, 620 px wide like the prototype drawer; closing it drops `inspect`.
export function LogInspector({
  slug,
  tab,
  id,
  sources,
  onClose,
  onOpen,
}: Readonly<{
  slug: string
  tab: LogsTab
  id: string | undefined
  sources: LogSources | undefined
  onClose: () => void
  onOpen: (id: string) => void
}>) {
  const { t } = useLingui()
  const connections = sources?.connections
  return (
    <Sheet open={id !== undefined} onOpenChange={(open) => !open && onClose()}>
      <SheetContent closeLabel={t`Close`} className="w-[min(620px,100vw)]">
        {id && tab === 'api' && <ApiInspector slug={slug} id={id} connections={connections} />}
        {id && tab === 'smtp' && <SmtpInspector slug={slug} id={id} connections={connections} />}
        {id && tab === 'webhooks' && (
          <WebhookInspector slug={slug} id={id} connections={connections} onOpen={onOpen} />
        )}
      </SheetContent>
    </Sheet>
  )
}
