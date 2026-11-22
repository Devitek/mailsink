import type { DeliveryStatus } from '@mailsink/contracts'

/** In-flight statuses, least advanced first. */
const IN_FLIGHT: readonly DeliveryStatus[] = ['queued', 'deferred', 'sent']
/** Final statuses, most severe first. */
const FINAL: readonly DeliveryStatus[] = [
  'failed',
  'hard_bounce',
  'soft_bounce',
  'complained',
  'delivered',
]

/**
 * Message status from its recipients' statuses (D10, rule « proposition »):
 * suppressed recipients are ignored unless all are; while any recipient is in flight the
 * least advanced in-flight status wins; once all are final, the most severe one wins.
 */
export function aggregateStatus(statuses: readonly DeliveryStatus[]): DeliveryStatus | undefined {
  if (statuses.length === 0) return undefined
  const active: readonly DeliveryStatus[] = statuses.filter((s) => s !== 'suppressed')
  if (active.length === 0) return 'suppressed'
  for (const status of [...IN_FLIGHT, ...FINAL]) {
    if (active.includes(status)) return status
  }
  return undefined
}
