import { Trans, useLingui } from '@lingui/react/macro'
import { SheetBody } from '@mailsink/ui'
import { useQuery } from '@tanstack/react-query'
import type { LogConnection } from '../../server-fns/logs-types'
import { SMTP_TONE, sessionDurationMs } from './format'
import { InspectorHeader, MessageLinks, Section } from './inspector-parts'
import { InspectorState } from './inspector-state'
import { CodeBadge, Duration, TypeBadge } from './log-badges'
import { smtpSessionQuery } from './queries'
import { sessionPeer } from './smtp-columns'

// SMTP session inspector (#41): the « SMTP dialogue » of the prototype, client lines (C)
// in accent text, server lines (S) muted, error replies in the failure colour. AUTH
// secrets are already redacted by the log writer (D146).
export function SmtpInspector({
  slug,
  id,
  connections,
}: Readonly<{ slug: string; id: string; connections: readonly LogConnection[] | undefined }>) {
  const { t } = useLingui()
  const { data: session, status } = useQuery(smtpSessionQuery(slug, id))
  if (!session) return <InspectorState status={status} />
  const connection = connections?.find((c) => c.id === session.connectionId)?.name
  return (
    <>
      <InspectorHeader
        badges={
          <>
            <TypeBadge kind="smtp" size="md">
              {session.secure ? 'SMTP TLS' : 'SMTP'}
            </TypeBadge>
            <CodeBadge tone={SMTP_TONE[session.outcome]} size="md">
              {session.outcome}
            </CodeBadge>
            <span className="font-mono text-[11.5px]">
              <Duration ms={sessionDurationMs(session)} />
            </span>
          </>
        }
        title={sessionPeer(session)}
        id={session.id}
        extra={connection}
        at={session.startedAt}
      />
      <SheetBody className="flex flex-col gap-[23px] px-6 py-[22px]">
        {session.error && (
          <p className="m-0 rounded-md border border-ms-border bg-ms-bg px-4 py-2.5 font-mono text-xs text-ms-danger">
            {session.error}
          </p>
        )}
        <Section title={<Trans>SMTP dialogue</Trans>}>
          <ol
            aria-label={t`SMTP dialogue`}
            className="m-0 list-none rounded-md border border-ms-border bg-ms-bg py-[11px] pl-0"
          >
            {session.transcript.map((line, index) => (
              <li
                // Lines have no id; the transcript never changes once stored.
                // biome-ignore lint/suspicious/noArrayIndexKey: immutable list
                key={index}
                className="grid grid-cols-[34px_minmax(0,1fr)] px-4 py-0.5 font-mono text-xs leading-relaxed"
              >
                <span
                  className={
                    line.dir === 'C'
                      ? 'font-semibold text-ms-accent-text'
                      : 'font-semibold text-ms-text-faint'
                  }
                >
                  {line.dir}:
                </span>
                <span
                  className={
                    line.dir === 'S' && /^[45]\d\d/.test(line.line)
                      ? 'break-all whitespace-pre-wrap text-ms-danger'
                      : line.dir === 'S'
                        ? 'break-all whitespace-pre-wrap text-ms-text-muted'
                        : 'break-all whitespace-pre-wrap text-ms-text'
                  }
                >
                  {line.line}
                </span>
              </li>
            ))}
          </ol>
        </Section>
        <MessageLinks slug={slug} ids={session.messageIds} />
      </SheetBody>
    </>
  )
}
