import type { ConnectionView, CreatedConnection, RateLimitSettings } from '@mailsink/contracts'

// Shapes of the workspace and connection management server functions (#38), serialisable.

/** Where a client sends its mail, without the secret (shown once, never stored in clear). */
export type ConnectionSetup =
  | { kind: 'resend' | 'brevo'; baseUrl: string }
  | { kind: 'smtp'; smtpHost: string; smtpPort: number; smtpUser: string }

export type ConnectionRow = ConnectionView & {
  setup: ConnectionSetup
  /** `.env` lines with the secret masked (key preview, or dots for an SMTP password). */
  maskedSnippet: string
}

export type WorkspaceSettings = {
  id: string
  slug: string
  name: string
  description: string | null
  ephemeral: boolean
  expiresAt: string | null
  retentionSeconds: number
  rateLimit: RateLimitSettings | null
}

export type ConnectionsPage = { workspace: WorkspaceSettings; connections: ConnectionRow[] }

/** A unique value the user typed is taken: shown on its field, not as a failure. */
export type Conflict = { ok: false; conflict: 'slug' | 'smtp_username' }

export type CreatedWorkspace = {
  ok: true
  slug: string
  /** `mskw_` key for Capture and MCP: shown once. */
  workspaceKey: string
  connections: CreatedConnection[]
}

export type ConnectionCreation = { ok: true; connection: CreatedConnection } | Conflict
