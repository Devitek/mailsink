import { Trans, useLingui } from '@lingui/react/macro'
import { Button, cn, SheetHeader, SheetTitle } from '@mailsink/ui'
import { Link } from '@tanstack/react-router'
import { type ReactNode, useState } from 'react'
import { formatLogDate } from './format'

// Building blocks of the inspector sheet (prototype log drawer): the header (badges,
// mono title, id line), section titles, code blocks and header tables.

export function InspectorHeader({
  badges,
  title,
  id,
  at,
  extra,
}: Readonly<{ badges: ReactNode; title: string; id: string; at: string; extra?: string }>) {
  const { i18n } = useLingui()
  return (
    <SheetHeader className="gap-0">
      <div className="mb-2 flex flex-wrap items-center gap-2.5">{badges}</div>
      <SheetTitle className="font-mono text-md break-all">{title}</SheetTitle>
      <p className="mt-1 font-mono text-[11.5px] text-ms-text-faint">
        {[id, extra, formatLogDate(at, i18n.locale)].filter(Boolean).join(' · ')}
      </p>
    </SheetHeader>
  )
}

export function Section({ title, children }: Readonly<{ title: ReactNode; children: ReactNode }>) {
  return (
    <section>
      <h3 className="mb-2.5 text-label font-medium tracking-[0.06em] text-ms-text-faint uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

export function CodeBlock({
  children,
  tone = 'muted',
}: Readonly<{ children: ReactNode; tone?: 'muted' | 'text' }>) {
  return (
    <pre
      className={cn(
        'm-0 max-h-[420px] overflow-auto rounded-md border border-ms-border bg-ms-bg px-[19px] py-4 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap',
        tone === 'muted' ? 'text-ms-text-muted' : 'text-ms-text',
      )}
    >
      {children}
    </pre>
  )
}

export function EmptyBody() {
  return (
    <p className="m-0 text-xs text-ms-text-faint">
      <Trans>No body.</Trans>
    </p>
  )
}

const SECRET_HEADERS = new Set(['authorization'])

/** A header value hidden behind « Show » (the Authorization of Brevo endpoints). */
function SecretValue({ name, value }: Readonly<{ name: string; value: string }>) {
  const { t } = useLingui()
  const [shown, setShown] = useState(false)
  const [scheme] = value.split(' ')
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="break-all">{shown ? value : `${scheme} ••••••••`}</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-5 px-1.5 font-sans"
        aria-label={shown ? t`Hide ${name}` : t`Show ${name}`}
        aria-pressed={shown}
        onClick={() => setShown((s) => !s)}
      >
        {shown ? <Trans>Hide</Trans> : <Trans>Show</Trans>}
      </Button>
    </span>
  )
}

/** Headers exactly as stored, name in accent text; Authorization masked until revealed. */
export function HeaderTable({
  headers,
  label,
}: Readonly<{ headers: Record<string, string>; label: string }>) {
  const entries = Object.entries(headers)
  if (entries.length === 0) return <EmptyBody />
  return (
    <dl
      aria-label={label}
      className="m-0 overflow-hidden rounded-md border border-ms-border bg-ms-bg"
    >
      {entries.map(([name, value]) => (
        <div
          key={name}
          className="grid grid-cols-[minmax(110px,170px)_minmax(0,1fr)] gap-[13px] border-b border-ms-border px-4 py-[9px] font-mono text-xs last:border-b-0"
        >
          <dt className="break-all text-ms-accent-text">{name}</dt>
          <dd className="m-0 break-all">
            {SECRET_HEADERS.has(name.toLowerCase()) ? (
              <SecretValue name={name} value={value} />
            ) : (
              value
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** Messages a log row produced, opened in the inbox viewer. */
export function MessageLinks({ slug, ids }: Readonly<{ slug: string; ids: readonly string[] }>) {
  if (ids.length === 0) return null
  return (
    <Section title={<Trans>Messages</Trans>}>
      <ul className="m-0 flex list-none flex-col gap-1 p-0 font-mono text-xs">
        {ids.map((id) => (
          <li key={id}>
            <Link
              to="/w/$workspaceSlug"
              params={{ workspaceSlug: slug }}
              search={{ m: id }}
              className="text-ms-accent-text underline-offset-4 hover:underline"
            >
              {id}
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  )
}
