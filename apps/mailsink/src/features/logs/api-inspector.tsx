import { Trans, useLingui } from '@lingui/react/macro'
import { SheetBody } from '@mailsink/ui'
import { useQuery } from '@tanstack/react-query'
import type { LogConnection } from '../../server-fns/logs-types'
import { httpTone } from './format'
import {
  CodeBlock,
  EmptyBody,
  HeaderTable,
  InspectorHeader,
  MessageLinks,
  Section,
} from './inspector-parts'
import { InspectorState } from './inspector-state'
import { CodeBadge, TypeBadge } from './log-badges'
import { apiLogQuery } from './queries'

// API call inspector (#41): request headers (credentials already redacted by the log
// writer, D146) and body, then the response status, error code, headers (stored since the
// migration 0003: older calls show none) and body.
export function ApiInspector({
  slug,
  id,
  connections,
}: Readonly<{ slug: string; id: string; connections: readonly LogConnection[] | undefined }>) {
  const { t } = useLingui()
  const { data: log, status } = useQuery(apiLogQuery(slug, id))
  if (!log) return <InspectorState status={status} />
  const connection = connections?.find((c) => c.id === log.connectionId)?.name
  return (
    <>
      <InspectorHeader
        badges={
          <>
            <TypeBadge kind="api" size="md">
              {log.dialect}
            </TypeBadge>
            <CodeBadge tone={httpTone(log.statusCode)} size="md">
              {log.statusCode}
            </CodeBadge>
            <span className="font-mono text-[11.5px] text-ms-text-faint">{log.durationMs} ms</span>
          </>
        }
        title={`${log.method} ${log.path}`}
        id={log.id}
        extra={connection}
        at={log.createdAt}
      />
      <SheetBody className="flex flex-col gap-[23px] px-6 py-[22px]">
        <Section title={<Trans>Request</Trans>}>
          <div className="flex flex-col gap-2.5">
            <HeaderTable headers={log.requestHeaders} label={t`Request headers`} />
            {log.requestBody ? <CodeBlock tone="text">{log.requestBody}</CodeBlock> : <EmptyBody />}
          </div>
        </Section>
        <Section title={<Trans>Response</Trans>}>
          <div className="flex flex-col gap-2.5">
            <CodeBlock>
              HTTP {log.statusCode}
              {log.errorCode ? ` · ${log.errorCode}` : ''}
              {log.ip ? `\n${t`Client`} ${log.ip}` : ''}
            </CodeBlock>
            <HeaderTable headers={log.responseHeaders} label={t`Response headers`} />
            {log.responseBody ? (
              <CodeBlock tone="text">{log.responseBody}</CodeBlock>
            ) : (
              <EmptyBody />
            )}
          </div>
        </Section>
        <MessageLinks slug={slug} ids={log.messageIds} />
      </SheetBody>
    </>
  )
}
