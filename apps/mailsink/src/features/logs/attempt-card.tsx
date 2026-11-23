import { Trans, useLingui } from '@lingui/react/macro'
import type { DeliveryStatus } from '@mailsink/contracts'
import { statusColorVar } from '@mailsink/ui'
import type { CSSProperties } from 'react'
import type { SignatureCheck } from '../../server-fns/logs-signature'
import type { InspectedAttempt } from '../../server-fns/logs-types'
import { formatLogDate, httpTone } from './format'
import { CodeBlock, HeaderTable } from './inspector-parts'

const CHECK_TONE: Record<SignatureCheck, DeliveryStatus> = {
  valid: 'delivered',
  invalid: 'hard_bounce',
  unsigned: 'queued',
  missing: 'soft_bounce',
}

function SignatureLine({
  check,
  secretPreview,
}: Readonly<{ check: SignatureCheck; secretPreview: string | null }>) {
  const secret = <span className="font-mono">{secretPreview ?? '-'}</span>
  return (
    <p
      style={{ '--tone': statusColorVar(CHECK_TONE[check]) } as CSSProperties}
      className="m-0 flex items-center gap-2 text-xs text-(--tone)"
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-(--tone)" />
      {check === 'valid' && <Trans>Signature valid with the secret {secret}</Trans>}
      {check === 'invalid' && (
        <Trans>Signature does not match the current secret {secret} (rotated since?)</Trans>
      )}
      {check === 'unsigned' && <Trans>Not signed: this Brevo endpoint has no authentication</Trans>}
      {check === 'missing' && <Trans>No signature header was sent</Trans>}
    </p>
  )
}

// One attempt of a delivery (#41): number, time, answer, duration, the signature check,
// then the exact headers sent (Authorization masked until revealed) and the response.
export function AttemptCard({
  attempt,
  secretPreview,
  open,
}: Readonly<{ attempt: InspectedAttempt; secretPreview: string | null; open: boolean }>) {
  const { t, i18n } = useLingui()
  const answer = attempt.responseStatus ?? attempt.error ?? t`no answer`
  const tone = statusColorVar(attempt.error ? 'failed' : httpTone(attempt.responseStatus))
  return (
    <details open={open} className="group border-b border-ms-border bg-ms-bg last:border-b-0">
      <summary className="grid cursor-pointer grid-cols-[40px_minmax(0,1fr)_minmax(0,1.2fr)_70px] items-center gap-[13px] px-4 py-[11px] font-mono text-xs outline-none hover:bg-ms-hover focus-visible:focus-ring">
        <span className="text-ms-text-faint">#{attempt.attemptNo}</span>
        <span className="truncate text-ms-text-muted">
          {formatLogDate(attempt.createdAt, i18n.locale)}
        </span>
        <span
          style={{ '--tone': tone } as CSSProperties}
          className="truncate font-semibold text-(--tone)"
          title={attempt.error ?? undefined}
        >
          {answer}
        </span>
        <span className="text-right text-ms-text-muted">{attempt.durationMs} ms</span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-ms-border px-4 py-3">
        <SignatureLine check={attempt.signature} secretPreview={secretPreview} />
        <HeaderTable headers={attempt.requestHeaders} label={t`Headers sent`} />
        {attempt.responseBody !== null && (
          <CodeBlock>{attempt.responseBody || t`(empty body)`}</CodeBlock>
        )}
      </div>
    </details>
  )
}
