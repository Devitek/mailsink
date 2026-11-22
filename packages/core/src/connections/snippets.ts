import type { ConnectionCredentials } from '@mailsink/contracts'

/** Where clients reach this Mailsink instance (from the runtime configuration). */
export interface PublicEndpoints {
  /** `MAILSINK_PUBLIC_URL`, without a trailing slash. */
  publicUrl: string
  smtpHost: string
  smtpPort: number
}

export type CredentialSecrets =
  | { kind: 'resend' | 'brevo'; apiKey: string }
  | { kind: 'smtp'; smtpUser: string; smtpPass: string }

/**
 * Secrets of a new connection plus where to use them. Resend routes live at the root
 * (`/emails`), Brevo routes under `/v3` (its SDK base path includes the version).
 */
export function buildCredentials(
  secrets: CredentialSecrets,
  endpoints: PublicEndpoints,
): ConnectionCredentials {
  switch (secrets.kind) {
    case 'resend':
      return { kind: 'resend', apiKey: secrets.apiKey, baseUrl: endpoints.publicUrl }
    case 'brevo':
      return { kind: 'brevo', apiKey: secrets.apiKey, baseUrl: `${endpoints.publicUrl}/v3` }
    case 'smtp':
      return {
        kind: 'smtp',
        smtpHost: endpoints.smtpHost,
        smtpPort: endpoints.smtpPort,
        smtpUser: secrets.smtpUser,
        smtpPass: secrets.smtpPass,
      }
  }
}

/** Ready-to-paste `.env` lines for the connection kind (`RESEND_BASE_URL` is read by the SDK). */
export function envSnippet(credentials: ConnectionCredentials): string {
  const lines: [string, string | number][] =
    credentials.kind === 'smtp'
      ? [
          ['SMTP_HOST', credentials.smtpHost],
          ['SMTP_PORT', credentials.smtpPort],
          ['SMTP_USER', credentials.smtpUser],
          ['SMTP_PASS', credentials.smtpPass],
        ]
      : [
          [`${credentials.kind.toUpperCase()}_API_KEY`, credentials.apiKey],
          [`${credentials.kind.toUpperCase()}_BASE_URL`, credentials.baseUrl],
        ]
  return lines.map(([name, value]) => `${name}=${value}\n`).join('')
}
