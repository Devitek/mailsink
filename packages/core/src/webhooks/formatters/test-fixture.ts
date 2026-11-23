import type { CanonicalEvent } from '@mailsink/contracts'
import { sampleContext } from '../sample'

// Shared fixture of the formatter contract tests (test-only).
export const now = new Date('2026-11-23T10:00:00.000Z')
export const ts = Math.floor(now.getTime() / 1000)
export const custom = [
  { key: 'X-Team', value: 'mail' },
  { key: 'content-type', value: 'text/plain' },
]
export const ctx = (canonical: CanonicalEvent, timezone = 'UTC') =>
  sampleContext({
    canonical,
    deliveryId: 'whd_0193a000-0000-7000-8000-000000000001',
    numericEndpointId: 42,
    workspace: { id: 'ws_1', slug: 'team', timezone },
    connection: { id: 'con_1', kind: 'resend' },
    now,
  })
