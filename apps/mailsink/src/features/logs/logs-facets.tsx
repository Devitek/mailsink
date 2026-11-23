import { useLingui } from '@lingui/react/macro'
import {
  ApiDialect,
  type LogsSearch,
  type LogsTab,
  PayloadFormat,
  SmtpOutcome,
  WebhookDeliveryStatus,
} from '@mailsink/contracts'
import { DataTableFacet, type DataTableFacetOption } from '@mailsink/ui'
import type { LogSources } from '../../server-fns/logs-types'
import type { SetLogsSearch } from './logs-pager'

// Faceted filters of each tab (#41), all server side through the URL: connection,
// dialect and status class (API), outcome (SMTP), status, payload format and endpoint
// (webhooks). Values are technical names, shown as is.

const plain = (values: readonly string[]): DataTableFacetOption[] =>
  values.map((value) => ({ value, label: value, text: value }))

const STATUS_CLASSES = ['2xx', '3xx', '4xx', '5xx']

export function LogsFacets({
  tab,
  search,
  setSearch,
  sources,
}: Readonly<{
  tab: LogsTab
  search: LogsSearch
  setSearch: SetLogsSearch
  sources: LogSources | undefined
}>) {
  const { t } = useLingui()
  const clearLabel = t`Clear filter`
  const one = (values: string[]) => values[0]
  const many = <T extends string>(values: string[]) => (values.length ? (values as T[]) : undefined)
  const connections = (sources?.connections ?? []).map((c) => ({
    value: c.id,
    label: c.name,
    text: c.name,
  }))
  const connection = connections.length > 0 && (
    <DataTableFacet
      title={t`Connection`}
      options={connections}
      selected={search.connectionId ? [search.connectionId] : []}
      onChange={(v) => setSearch({ connectionId: one(v) })}
      multiple={false}
      clearLabel={clearLabel}
    />
  )

  if (tab === 'api') {
    return (
      <>
        {connection}
        <DataTableFacet
          title={t`Dialect`}
          options={plain(ApiDialect.options)}
          selected={search.dialect ?? []}
          onChange={(v) => setSearch({ dialect: many(v) })}
          clearLabel={clearLabel}
        />
        <DataTableFacet
          title={t`Status`}
          options={plain(STATUS_CLASSES)}
          selected={search.code ?? []}
          onChange={(v) => setSearch({ code: many(v) })}
          clearLabel={clearLabel}
        />
      </>
    )
  }
  if (tab === 'smtp') {
    return (
      <>
        {connection}
        <DataTableFacet
          title={t`Outcome`}
          options={plain(SmtpOutcome.options)}
          selected={search.outcome ?? []}
          onChange={(v) => setSearch({ outcome: many(v) })}
          clearLabel={clearLabel}
        />
      </>
    )
  }
  const endpoints = (sources?.endpoints ?? []).map((e) => ({
    value: e.id,
    label: <span className="font-mono">{e.url}</span>,
    text: e.url,
  }))
  return (
    <>
      <DataTableFacet
        title={t`Status`}
        options={plain(WebhookDeliveryStatus.options)}
        selected={search.delivery ? [search.delivery] : []}
        onChange={(v) => setSearch({ delivery: WebhookDeliveryStatus.optional().parse(one(v)) })}
        multiple={false}
        clearLabel={clearLabel}
      />
      <DataTableFacet
        title="payloadFormat"
        options={plain(PayloadFormat.options)}
        selected={search.format ? [search.format] : []}
        onChange={(v) => setSearch({ format: PayloadFormat.optional().parse(one(v)) })}
        multiple={false}
        clearLabel={clearLabel}
      />
      {endpoints.length > 0 && (
        <DataTableFacet
          title={t`Endpoint`}
          options={endpoints}
          selected={search.endpointId ? [search.endpointId] : []}
          onChange={(v) => setSearch({ endpointId: one(v) })}
          multiple={false}
          clearLabel={clearLabel}
        />
      )}
    </>
  )
}
