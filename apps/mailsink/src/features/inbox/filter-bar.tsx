import { useLingui } from '@lingui/react/macro'
import { DeliveryStatus, type InboxSearch } from '@mailsink/contracts'
import type { InboxFacets } from '@mailsink/core'
import { cn, Input, statusColorVar } from '@mailsink/ui'
import { type CSSProperties, useEffect, useState } from 'react'
import { connectionChipLabel } from './connection-label'
import { Count, Segmented } from './segmented'

/** Statuses always offered (the prototype's), others only once a message has them. */
const ALWAYS = new Set([
  'delivered',
  'hard_bounce',
  'soft_bounce',
  'complained',
  'suppressed',
  'failed',
])
const SEARCH_DELAY_MS = 300

export type SetSearch = (change: Partial<InboxSearch>, options?: { replace?: boolean }) => void

// Filters of the inbox list (#39): search box, connection segments and status chips with
// their counts over the whole inbox, plus the tag filter set from the viewer. Everything
// lives in the URL (InboxSearch).
export function FilterBar({
  search,
  facets,
  setSearch,
}: Readonly<{ search: InboxSearch; facets: InboxFacets | undefined; setSearch: SetSearch }>) {
  const { t } = useLingui()
  const [text, setText] = useState(search.q ?? '')
  useEffect(() => setText(search.q ?? ''), [search.q])
  useEffect(() => {
    if (text.trim() === (search.q ?? '')) return
    const id = setTimeout(
      () => setSearch({ q: text.trim() || undefined, m: undefined }, { replace: true }),
      SEARCH_DELAY_MS,
    )
    return () => clearTimeout(id)
  }, [text, search.q, setSearch])

  const connections = facets?.connections ?? []
  const statuses = DeliveryStatus.options.filter(
    (s) => ALWAYS.has(s) || (facets?.byStatus[s] ?? 0) > 0,
  )
  const all = t`All`
  return (
    <div className="flex flex-col gap-2.5 border-b border-ms-border p-3.5">
      <div className="relative">
        <span
          aria-hidden
          className="absolute top-[9px] left-2.5 size-[11px] rounded-full border-[1.5px] border-ms-text-faint"
        />
        <Input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label={t`Search messages`}
          placeholder={t`Search subject, body, to:, from:…`}
          className="rounded-md pl-[41px] text-sm"
        />
      </div>
      {connections.length > 0 && (
        <Segmented
          label={t`Connection`}
          value={search.connectionId ?? 'all'}
          onChange={(v) => setSearch({ connectionId: v === 'all' ? undefined : v, m: undefined })}
          options={[
            {
              value: 'all',
              label: (
                <>
                  {all} <Count value={facets?.total} />
                </>
              ),
              title: all,
            },
            ...connections.map((c) => {
              const label = connectionChipLabel(c, connections)
              return {
                value: c.id,
                label: (
                  <>
                    {label} <Count value={c.count} />
                  </>
                ),
                title: label,
              }
            }),
          ]}
        />
      )}
      <fieldset aria-label={t`Status`} className="flex flex-wrap gap-[5px]">
        {statuses.map((status) => {
          const active = search.status === status
          return (
            <button
              key={status}
              type="button"
              aria-pressed={active}
              aria-label={status}
              onClick={() => setSearch({ status: active ? undefined : status, m: undefined })}
              style={{ '--status': statusColorVar(status) } as CSSProperties}
              className={cn(
                'inline-flex h-[22px] cursor-pointer items-center gap-1.5 rounded-sm border px-[9px] font-mono text-badge font-medium outline-none transition-colors duration-fast ease-ms focus-visible:focus-ring',
                active
                  ? 'border-(--status) bg-[color-mix(in_oklch,var(--status)_14%,transparent)] text-(--status)'
                  : 'border-ms-border-strong text-ms-text-muted hover:bg-ms-hover',
              )}
            >
              <span aria-hidden className="size-1.5 rounded-full bg-(--status)" />
              {status}
              <Count value={facets?.byStatus[status]} />
            </button>
          )
        })}
        {search.tag && (
          <button
            type="button"
            onClick={() => setSearch({ tag: undefined, m: undefined })}
            aria-label={t`Remove the tag filter ${search.tag}`}
            className="inline-flex h-[22px] cursor-pointer items-center gap-1.5 rounded-sm border border-ms-accent-text px-[9px] font-mono text-badge text-ms-text outline-none focus-visible:focus-ring"
          >
            {search.tag}
            <span aria-hidden>×</span>
          </button>
        )}
      </fieldset>
    </div>
  )
}
