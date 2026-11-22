import type { OverrideView } from '@mailsink/contracts'
import type { Override } from '@mailsink/db'

export function toOverrideView(row: Override): OverrideView {
  return {
    id: row.id,
    connectionId: row.connectionId,
    config: row.config,
    activatedVia: row.activatedVia,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}
