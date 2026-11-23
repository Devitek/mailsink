// Shapes the UI server functions return (serialisable: dates as ISO strings).

export type WorkspaceSummary = {
  id: string
  slug: string
  name: string
  ephemeral: boolean
  /** Ephemeral workspaces only: when the GC deletes it if nothing touches it. */
  expiresAt: string | null
  /** Picker lists only: captured messages of a persistent workspace. */
  messageCount?: number
}

export type WorkspaceList = {
  persistent: WorkspaceSummary[]
  /** Empty unless asked for (the picker hides them by default). */
  ephemeral: WorkspaceSummary[]
  ephemeralCount: number
}
