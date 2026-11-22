import { describe, expect, it } from 'vitest'
import { resolveSettings, type SettingsLayers, toSimulationSettings } from './settings-resolver'

const base: SettingsLayers = {
  workspace: {
    simulation: { rates: { delivered: 100 } },
    rateLimit: { limit: 5, windowSeconds: 1 },
  },
  connection: null,
  workspaceOverride: null,
  connectionOverride: null,
}

describe('resolveSettings', () => {
  it('fills a partial workspace row with the contract defaults', () => {
    const s = resolveSettings(base)
    expect(toSimulationSettings(s)).toEqual({
      rates: { delivered: 100 },
      rules: [],
      latency: { minMs: 0, maxMs: 0 },
      openRate: 0,
      clickRate: 0,
    })
    expect(s.chaos).toBeNull()
    expect(s.rateLimit).toEqual({ limit: 5, windowSeconds: 1 })
    expect(s.overrideIds).toEqual({ workspace: null, connection: null })
  })

  it('resolves field by field: connection override > workspace override > connection > workspace', () => {
    const s = resolveSettings({
      workspace: {
        simulation: { rates: { failed: 1 }, latency: { minMs: 1, maxMs: 1 }, openRate: 5 },
        rateLimit: null,
      },
      connection: {
        simulation: { rules: [{ match: 'c@*', status: 'failed' }], clickRate: 7 },
        rateLimit: { limit: 9, windowSeconds: 1 },
      },
      workspaceOverride: {
        id: 'ovr_ws',
        config: {
          rates: { hard_bounce: 50 },
          chaos: { errorRate: 10, httpCodes: [500], smtpCodes: [451] },
        },
      },
      connectionOverride: { id: 'ovr_con', config: { latency: { minMs: 9, maxMs: 9 } } },
    })
    expect(s.rates).toEqual({ hard_bounce: 50 })
    expect(s.rules).toEqual([{ match: 'c@*', status: 'failed' }])
    expect(s.latency).toEqual({ minMs: 9, maxMs: 9 })
    expect(s.openRate).toBe(5)
    expect(s.clickRate).toBe(7)
    expect(s.chaos?.errorRate).toBe(10)
    expect(s.rateLimit).toEqual({ limit: 9, windowSeconds: 1 })
    expect(s.sources).toEqual({
      rates: 'workspace_override',
      rules: 'connection',
      latency: 'connection_override',
      openRate: 'workspace',
      clickRate: 'connection',
      chaos: 'workspace_override',
      rateLimit: 'connection',
    })
    expect(s.overrideIds).toEqual({ workspace: 'ovr_ws', connection: 'ovr_con' })
  })

  it('takes a field whole from one layer (rates are not merged)', () => {
    const s = resolveSettings({
      ...base,
      workspace: { simulation: { rates: { failed: 10, deferred: 10 } }, rateLimit: null },
      connectionOverride: {
        id: 'ovr_c',
        config: { rates: { complained: 5 }, rateLimit: { limit: 1, windowSeconds: 1 } },
      },
    })
    expect(s.rates).toEqual({ complained: 5 })
    expect(s.rateLimit).toEqual({ limit: 1, windowSeconds: 1 })
  })
})
