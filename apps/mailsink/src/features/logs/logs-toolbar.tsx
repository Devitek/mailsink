import { useLingui } from '@lingui/react/macro'
import type { LogsSearch, LogsTab } from '@mailsink/contracts'
import { Input } from '@mailsink/ui'
import { useEffect, useState } from 'react'
import type { LogSources } from '../../server-fns/logs-types'
import { Count, Segmented } from '../inbox/segmented'
import { LogsFacets } from './logs-facets'
import type { SetLogsSearch } from './logs-pager'
import { tabOf } from './search-query'

const SEARCH_DELAY_MS = 300

// Header of the prototype « Logs » view: title, the API / SMTP / Webhooks segments with
// their counts, the facets of the tab, then the search box (API path, SMTP peer).
export function LogsToolbar({
  search,
  setSearch,
  sources,
}: Readonly<{ search: LogsSearch; setSearch: SetLogsSearch; sources: LogSources | undefined }>) {
  const { t } = useLingui()
  const tab = tabOf(search)
  const [text, setText] = useState(search.q ?? '')
  useEffect(() => setText(search.q ?? ''), [search.q])
  useEffect(() => {
    if (text.trim() === (search.q ?? '')) return
    const id = setTimeout(
      () => setSearch({ q: text.trim() || undefined }, { replace: true }),
      SEARCH_DELAY_MS,
    )
    return () => clearTimeout(id)
  }, [text, search.q, setSearch])

  const counts = sources?.counts
  const tabs: { value: LogsTab; label: string }[] = [
    { value: 'api', label: t`API / Providers` },
    { value: 'smtp', label: 'SMTP' },
    { value: 'webhooks', label: t`Webhooks` },
  ]
  return (
    <div className="flex flex-wrap items-center gap-[13px] border-b border-ms-border bg-ms-panel px-6 py-[19px]">
      <h2 className="m-0 mr-2.5 text-heading font-semibold">{t`Logs`}</h2>
      <Segmented
        label={t`Log type`}
        value={tab}
        onChange={(value) => setSearch({ tab: value })}
        className="[&>button]:flex-none"
        options={tabs.map((o) => ({
          value: o.value,
          title: o.label,
          label: (
            <>
              {o.label} <Count value={counts?.[o.value]} />
            </>
          ),
        }))}
      />
      <fieldset aria-label={t`Filters`} className="m-0 flex flex-wrap gap-2 border-0 p-0">
        <LogsFacets tab={tab} search={search} setSearch={setSearch} sources={sources} />
      </fieldset>
      <div className="flex-1" />
      {tab !== 'webhooks' && (
        <Input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label={tab === 'api' ? t`Filter by path` : t`Filter by address, host or user`}
          placeholder={
            tab === 'api' ? t`Filter path, e.g. /emails…` : t`Filter address, host, user…`
          }
          className="w-[260px] max-w-full"
        />
      )}
    </div>
  )
}
