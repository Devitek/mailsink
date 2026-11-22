import { z } from 'zod'
import { Duration, IsoDateTime, issue } from './common'
import { ConnectionId, OverrideId } from './ids'
import {
  Chaos,
  Latency,
  RateLimitSettings,
  RecipientRule,
  SimulationSettings,
  StatusRates,
} from './settings'
import { EventOrigin } from './status'

export const OverrideConfig = z
  .object({
    rates: StatusRates.optional(),
    rules: z.array(RecipientRule).max(50).optional(),
    latency: Latency.optional(),
    chaos: Chaos.optional(),
    rateLimit: RateLimitSettings.optional(),
  })
  .refine(
    (c) => Object.values(c).some((v) => v !== undefined),
    issue('override_empty', 'An override needs at least one setting'),
  )

export const ActivateOverrideRequest = z.object({
  connectionId: ConnectionId.optional(), // omitted = workspace-wide
  config: OverrideConfig,
  ttl: Duration.optional(), // auto-reset after, in seconds
})

export const ResetOverrideRequest = z.object({ connectionId: ConnectionId.optional() })

export const OverrideView = z.object({
  id: OverrideId,
  connectionId: ConnectionId.nullable(),
  config: OverrideConfig,
  activatedVia: EventOrigin,
  expiresAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
})

export const OverrideState = z.object({
  workspace: OverrideView.nullable(),
  connections: z.array(OverrideView),
  effective: z.record(ConnectionId, SimulationSettings), // per connection, resolved
})

export type OverrideConfig = z.output<typeof OverrideConfig>
export type ActivateOverrideRequest = z.output<typeof ActivateOverrideRequest>
export type OverrideView = z.output<typeof OverrideView>
export type OverrideState = z.output<typeof OverrideState>
