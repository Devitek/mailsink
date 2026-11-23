// Override API (03-contracts, « Settings and override »): workspace scope auth (D12, D41).
import { ActivateOverrideRequest, ResetOverrideRequest } from '@mailsink/contracts'
import { activateOverride, getOverrideState, resetOverride } from '@mailsink/core'
import { defineApi } from '../handler'

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
    activateOverride(runtime.db.db, auth.workspace, body, 'api'),
})

/** POST /capture/override/reset: back to the settings for the scope (idempotent). */
export const postOverrideReset = defineApi({
  auth: 'workspace',
  body: ResetOverrideRequest,
  handler: ({ runtime, auth, body }) =>
    resetOverride(runtime.db.db, auth.workspace, body.connectionId),
})
