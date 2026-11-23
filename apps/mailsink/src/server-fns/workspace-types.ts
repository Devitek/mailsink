// Shapes the UI server functions return (serialisable: dates as ISO strings).

export type WorkspaceSummary = {
  id: string
  slug: string
  name: string
  ephemeral: boolean
  /** Ephemeral workspaces only: when the GC deletes it if nothing touches it. */
  expiresAt: string | null
  /** Ephemeral workspaces only: the idle TTL that `expiresAt` restarts from. */
  idleTtlSeconds?: number | null
  /** Picker lists only: captured messages of a persistent workspace. */
  messageCount?: number
}

/** One page of one picker section (persistent or ephemeral workspaces), newest first. */
export type WorkspacePage = {
  data: WorkspaceSummary[]
  /** Id to pass as `cursor` for the next page; null on the last one. */
  nextCursor: string | null
  /** Every ephemeral workspace, whatever the search: the caption of the picker switch. */
  ephemeralCount: number
}
