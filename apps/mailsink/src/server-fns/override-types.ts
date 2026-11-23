import type {
  ConnectionKind,
  OverrideState,
  RateLimitSettings,
  SimulationSettings,
} from '@mailsink/contracts'

// Shape of the override panel server function (#42), serialisable.

export type OverrideConnection = { id: string; name: string; kind: ConnectionKind }

export type OverridePanel = {
  state: OverrideState
  /** Targets of the panel besides the whole workspace. */
  connections: OverrideConnection[]
  /** Workspace settings (no override): starting values of a workspace-wide override. */
  settings: SimulationSettings
  rateLimit: RateLimitSettings | null
}
