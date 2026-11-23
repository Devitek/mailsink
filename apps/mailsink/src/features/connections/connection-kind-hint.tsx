import { Trans } from '@lingui/react/macro'
import type { ConnectionKind } from '@mailsink/contracts'

// What the server generates for a new connection of this kind, under its creation form.
export function ConnectionKindHint({ kind }: Readonly<{ kind: ConnectionKind }>) {
  return (
    <p className="rounded-md border border-dashed border-ms-border-strong p-4 text-sm text-pretty text-ms-text-muted">
      {kind === 'smtp' ? (
        <Trans>
          SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS are generated on creation. Works with
          Nodemailer, Symfony Mailer, Django…
        </Trans>
      ) : (
        <Trans>
          An msk_… key is generated on creation. Point the provider SDK at the Mailsink base URL: no
          application code change.
        </Trans>
      )}
    </p>
  )
}
