// Override API (03-contracts, « Settings and override »): workspace scope auth (D12, D41).
import {
  ActivateOverrideRequest,
  type OverrideState,
  ResetOverrideRequest,
} from '@mailsink/contracts'
import {
  activateOverride,
  getOverrideState,
  overrideChangedFrame,
  resetOverride,
} from '@mailsink/core'
import type { Runtime } from '../../runtime/container'
import { defineApi } from '../handler'

/** Every activation and reset publishes the new state (D96), even an idempotent reset. */
function published(
  runtime: Runtime,
  workspaceId: string,
  connectionId: string | undefined,
  state: OverrideState,
): OverrideState {
  runtime.bus.publish(workspaceId, overrideChangedFrame(state, connectionId ?? null))
  return state
}

/** GET /capture/override: active overrides and the effective settings per connection. */
export const getOverride = defineApi({
  auth: 'workspace',
  handler: ({ runtime, auth }) => getOverrideState(runtime.db.db, auth.workspace),
})

/** POST /capture/override: replaces the active override of the scope (optional TTL). */
export const postOverride = defineApi({
  auth: 'workspace',
  body: ActivateOverrideRequest,
  handler: async ({ runtime, auth, body }) =>
    published(
      runtime,
      auth.workspace.id,
      body.connectionId,
      await activateOverride(runtime.db.db, auth.workspace, body, 'api'),
    ),
})

/** POST /capture/override/reset: back to the settings for the scope (idempotent). */
export const postOverrideReset = defineApi({
  auth: 'workspace',
  body: ResetOverrideRequest,
  handler: async ({ runtime, auth, body }) =>
    published(
      runtime,
      auth.workspace.id,
      body.connectionId,
      await resetOverride(runtime.db.db, auth.workspace, body.connectionId),
    ),
})
