import { cn } from '@mailsink/ui'
import type { ReactNode } from 'react'
import { CopyButton } from '../shell/copy-button'

// Read-only credential values of the prototype connection panel: a mono box on the page
// background, then its actions (copy, rotate). Labels such as SMTP_HOST stay in mono.

export function ValueBox({
  children,
  className,
  testId,
}: Readonly<{ children: ReactNode; className?: string; testId?: string }>) {
  return (
    <div
      data-testid={testId}
      className={cn(
        'flex h-control-md min-w-0 flex-[1_1_220px] items-center overflow-hidden rounded-md border border-ms-border-strong bg-ms-bg px-3.5 font-mono text-sm whitespace-nowrap',
        className,
      )}
    >
      <span className="truncate">{children}</span>
    </div>
  )
}

export function CredentialRow({
  label,
  value,
  mono = true,
  copyValue,
  copyLabel,
  actions,
  testId,
}: Readonly<{
  label: ReactNode
  value: ReactNode
  mono?: boolean
  /** Shows a copy button for this exact value. */
  copyValue?: string
  copyLabel?: string
  actions?: ReactNode
  testId?: string
}>) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span
        className={cn('text-xs font-medium text-ms-text-muted', mono && 'font-mono text-[11.5px]')}
      >
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        <ValueBox testId={testId}>{value}</ValueBox>
        {copyValue !== undefined && <CopyButton value={copyValue} label={copyLabel} />}
        {actions}
      </div>
    </div>
  )
}

/** « Snippet .env prêt à copier »: title, copy button, then the lines in a mono block. */
export function EnvSnippet({
  title,
  snippet,
  copyLabel,
}: Readonly<{ title: ReactNode; snippet: string; copyLabel?: string }>) {
  return (
    <div>
      <div className="mb-2 flex items-center">
        <span className="flex-1 text-xs font-medium text-ms-text-muted">{title}</span>
        <CopyButton value={snippet} label={copyLabel} size="sm" />
      </div>
      <pre
        data-testid="env-snippet"
        className="m-0 rounded-md border border-ms-border bg-ms-bg px-[19px] py-4 font-mono text-xs leading-[1.65] break-all whitespace-pre-wrap text-ms-text-muted"
      >
        {snippet}
      </pre>
    </div>
  )
}
