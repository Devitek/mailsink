import { useLingui } from '@lingui/react/macro'
import type { LogsSearch } from '@mailsink/contracts'
import { useQuery } from '@tanstack/react-query'
import { useNow } from '../inbox/relative-time'
import { LogInspector } from './log-inspector'
import type { SetLogsSearch } from './logs-pager'
import { ApiLogsTable, SmtpLogsTable, WebhookLogsTable } from './logs-tables'
import { LogsToolbar } from './logs-toolbar'
import { logSourcesQuery } from './queries'
import { tabOf } from './search-query'

// Logs explorer of a workspace (#41, prototype « Logs »): toolbar, the DataTable of the
// tab with its pager, and the inspector sheet of the row named by `?inspect=`.
export function LogsPage({
  slug,
  search,
  setSearch,
}: Readonly<{ slug: string; search: LogsSearch; setSearch: SetLogsSearch }>) {
  const { t } = useLingui()
  const tab = tabOf(search)
  const { data: sources } = useQuery(logSourcesQuery(slug))
  const now = useNow()
  const props = { slug, search, setSearch, sources, now }
  return (
    <section aria-label={t`Logs`} className="flex min-h-0 min-w-0 flex-1 flex-col">
      <LogsToolbar search={search} setSearch={setSearch} sources={sources} />
      {tab === 'api' && <ApiLogsTable {...props} />}
      {tab === 'smtp' && <SmtpLogsTable {...props} />}
      {tab === 'webhooks' && <WebhookLogsTable {...props} />}
      <LogInspector
        slug={slug}
        tab={tab}
        id={search.inspect}
        sources={sources}
        onClose={() => setSearch({ inspect: undefined })}
        onOpen={(id) => setSearch({ inspect: id })}
      />
    </section>
  )
}
