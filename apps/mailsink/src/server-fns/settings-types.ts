import type {
  CanonicalEvent,
  ConnectionKind,
  PayloadFormat,
  RateLimitSettings,
  SimulationSettings,
} from '@mailsink/contracts'

// Shapes of the workspace settings server functions (#43), serialisable.

/** A connection as the settings screen needs it: webhook scopes and the MCP hint. */
export type SettingsConnection = {
  id: string
  name: string
  kind: ConnectionKind
  disabled: boolean
}

/** One selectable webhook event in the dialect of a format, and what it stands for. */
export type EventChoice = { name: string; events: CanonicalEvent[] }

/** Selectable events per payload format, in contract order (D22, D135). */
export type EventCatalog = Record<PayloadFormat, EventChoice[]>

export type SettingsPage = {
  workspace: {
    id: string
    slug: string
    name: string
    retentionSeconds: number
    maxMessages: number | null
    rateLimit: RateLimitSettings | null
    simulation: SimulationSettings
    /** Messages currently kept, for the quota gauge. */
    messageCount: number
    /** `MAILSINK_PUBLIC_URL` and the MCP endpoint built on it. */
    publicUrl: string
    mcpUrl: string
  }
  connections: SettingsConnection[]
  eventCatalog: EventCatalog
}
