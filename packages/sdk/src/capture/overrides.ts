import * as C from '@mailsink/contracts'
import type { Transport } from '../http'
import type { OverrideConfig, OverrideState } from '../types'

export interface OverrideScope {
  /** Connection scope; omitted = the whole workspace. */
  connectionId?: string
}

export interface ActivateOptions extends OverrideScope {
  /** Auto-reset after this many seconds, or `"90s"`, `"30m"`, `"1h"`. */
  ttl?: number | string
}

/** `/capture/override`: temporary simulation settings (rates, rules, latency, chaos...). */
export function overridesApi(t: Transport) {
  const api = {
    /** Active overrides and the effective settings per connection. */
    get: () =>
      t.json<OverrideState>({
        method: 'GET',
        path: '/capture/override',
        auth: 'workspace',
        schema: C.OverrideState,
      }),
    /** Replaces the active override of the scope. */
    activate: (config: OverrideConfig, options: ActivateOptions = {}) =>
      t.json<OverrideState>({
        method: 'POST',
        path: '/capture/override',
        auth: 'workspace',
        body: { config, connectionId: options.connectionId, ttl: options.ttl },
        schema: C.OverrideState,
      }),
    /** Back to the settings for the scope (idempotent). */
    reset: (options: OverrideScope = {}) =>
      t.json<OverrideState>({
        method: 'POST',
        path: '/capture/override/reset',
        auth: 'workspace',
        body: { connectionId: options.connectionId },
        schema: C.OverrideState,
      }),
    /**
     * Runs `fn` under an override and always resets the scope afterwards, `fn` failing
     * included. Resolves what `fn` resolves.
     */
    with: async <T>(
      config: OverrideConfig,
      fn: () => T | Promise<T>,
      options: ActivateOptions = {},
    ): Promise<T> => {
      await api.activate(config, options)
      try {
        return await fn()
      } finally {
        await api.reset({ connectionId: options.connectionId })
      }
    },
  }
  return api
}

export type OverridesApi = ReturnType<typeof overridesApi>
