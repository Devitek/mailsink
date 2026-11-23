// Override API (03-contracts, « Settings and override »): workspace scope auth (D12, D41).
// Every activation and reset publishes the new state (D96), even an idempotent reset.
import { ActivateOverrideRequest, ResetOverrideRequest } from '@mailsink/contracts'
import {
  activateAndPublishOverride,
  getOverrideState,
  resetAndPublishOverride,
} from '@mailsink/core'
import type { Runtime } from '../../runtime/container'
import { defineApi } from '../handler'

const live = (runtime: Runtime) => ({ db: runtime.db.db, bus: runtime.bus })

/** GET /capture/override: active overrides and the effective settings per connection. */
export const getOverride = defineApi({
  auth: 'workspace',
  handler: ({ runtime, auth }) => getOverrideState(runtime.db.db, auth.workspace),
})

/** POST /capture/override: replaces the active override of the scope (optional TTL). */
export const postOverride = defineApi({
  auth: 'workspace',
  body: ActivateOverrideRequest,
  handler: ({ runtime, auth, body }) =>
    activateAndPublishOverride(live(runtime), auth.workspace, body, 'api'),
})

/** POST /capture/override/reset: back to the settings for the scope (idempotent). */
export const postOverrideReset = defineApi({
  auth: 'workspace',
  body: ResetOverrideRequest,
  handler: ({ runtime, auth, body }) =>
    resetAndPublishOverride(live(runtime), auth.workspace, body.connectionId),
})
