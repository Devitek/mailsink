import { Trans, useLingui } from '@lingui/react/macro'
import type { CreatedConnection } from '@mailsink/contracts'
import type { ReactNode } from 'react'
import { CredentialRow, EnvSnippet } from './credential-fields'

/** « Copy them now »: secrets live only in this answer, the server keeps hashes (D11). */
export function ShownOnceNotice({ children }: Readonly<{ children?: ReactNode }>) {
  return (
    <div
      role="status"
      className="rounded-md border border-[color-mix(in_oklch,var(--ms-override)_40%,transparent)] bg-[color-mix(in_oklch,var(--ms-override)_10%,transparent)] px-4 py-3 text-sm text-ms-text"
    >
      {children ?? (
        <Trans>
          Copy these credentials now: they are shown only once. Mailsink keeps a hash, not the
          secret; rotate to get a new one.
        </Trans>
      )}
    </div>
  )
}

// Credentials of a connection right after its creation or rotation (#38): every value with
// its copy button, then the `.env` snippet built by the server (D52).
export function CredentialsReveal({ connection }: Readonly<{ connection: CreatedConnection }>) {
  const { t } = useLingui()
  const c = connection.credentials
  return (
    <div className="flex flex-col gap-[18px]" data-testid="credentials-reveal">
      <ShownOnceNotice />
      {c.kind === 'smtp' ? (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-[13px]">
            <CredentialRow label="SMTP_HOST" value={c.smtpHost} />
            <CredentialRow label="SMTP_PORT" value={c.smtpPort} />
          </div>
          <CredentialRow
            label="SMTP_USER"
            value={c.smtpUser}
            copyValue={c.smtpUser}
            copyLabel={t`Copy SMTP_USER`}
          />
          <CredentialRow
            label="SMTP_PASS"
            value={c.smtpPass}
            copyValue={c.smtpPass}
            copyLabel={t`Copy SMTP_PASS`}
            testId="secret-value"
          />
        </>
      ) : (
        <>
          <CredentialRow
            label={<Trans>API key</Trans>}
            mono={false}
            value={c.apiKey}
            copyValue={c.apiKey}
            copyLabel={t`Copy the API key`}
            testId="secret-value"
          />
          <CredentialRow
            label={<Trans>Base URL</Trans>}
            mono={false}
            value={c.baseUrl}
            copyValue={c.baseUrl}
            copyLabel={t`Copy the base URL`}
          />
        </>
      )}
      <EnvSnippet
        title={<Trans>Ready-to-copy .env snippet</Trans>}
        snippet={connection.envSnippet}
        copyLabel={t`Copy the .env snippet`}
      />
    </div>
  )
}
