import {
  type Chaos,
  type OverrideConfig,
  type RateLimitSettings,
  SimulationSettings,
  type SimulationSettingsPatch,
} from '@mailsink/contracts'

/** Where a resolved value comes from, highest precedence first. */
export type SettingsLayer =
  | 'connection_override'
  | 'workspace_override'
  | 'connection'
  | 'workspace'
  | 'default'

export interface ActiveOverride {
  id: string
  config: OverrideConfig
}

/** The four layers of 02-database-schema « overrides », as stored. */
export interface SettingsLayers {
  /** `workspaces.simulation` (complete since D44, parsed again to be safe). */
  workspace: { simulation: unknown; rateLimit: RateLimitSettings | null }
  /** `connections.simulation` / `rate_limit`; null when the message has no connection. */
  connection: {
    simulation: SimulationSettingsPatch | null
    rateLimit: RateLimitSettings | null
  } | null
  workspaceOverride: ActiveOverride | null
  connectionOverride: ActiveOverride | null
}

export interface EffectiveSettings extends SimulationSettings {
  /** Request-level failures (#25); null when no override sets it. */
  chaos: Chaos | null
  /** Token bucket (#24); null = unlimited. */
  rateLimit: RateLimitSettings | null
  /** Layer each field was taken from (stored in the decision snapshot). */
  sources: Record<keyof SimulationSettings | 'chaos' | 'rateLimit', SettingsLayer>
  overrideIds: { workspace: string | null; connection: string | null }
}

type Candidate<T> = [SettingsLayer, T | null | undefined]

function pick<T>(candidates: Candidate<T>[], fallback: T): [T, SettingsLayer] {
  for (const [layer, value] of candidates) {
    if (value !== undefined && value !== null) return [value, layer]
  }
  return [fallback, 'default']
}

/**
 * Field by field: connection override > workspace override > connection settings >
 * workspace settings. A field is taken whole from the first layer that defines it (rates
 * are not merged status by status). Overrides carry no `openRate` / `clickRate`; only
 * overrides carry `chaos`.
 */
export function resolveSettings(layers: SettingsLayers): EffectiveSettings {
  const workspace = SimulationSettings.parse(layers.workspace.simulation ?? {})
  const co = layers.connectionOverride?.config
  const wo = layers.workspaceOverride?.config
  const cs = layers.connection?.simulation ?? undefined
  const four = <T>(c: T | undefined, w: T | undefined, s: T | undefined, base: T) =>
    pick<T>(
      [
        ['connection_override', c],
        ['workspace_override', w],
        ['connection', s],
        ['workspace', base],
      ],
      base,
    )
  const two = (s: number | undefined, base: number) =>
    pick<number>(
      [
        ['connection', s],
        ['workspace', base],
      ],
      base,
    )
  const [rates, ratesFrom] = four(co?.rates, wo?.rates, cs?.rates, workspace.rates)
  const [rules, rulesFrom] = four(co?.rules, wo?.rules, cs?.rules, workspace.rules)
  const [latency, latencyFrom] = four(co?.latency, wo?.latency, cs?.latency, workspace.latency)
  const [openRate, openFrom] = two(cs?.openRate, workspace.openRate)
  const [clickRate, clickFrom] = two(cs?.clickRate, workspace.clickRate)
  const [chaos, chaosFrom] = pick<Chaos | null>(
    [
      ['connection_override', co?.chaos],
      ['workspace_override', wo?.chaos],
    ],
    null,
  )
  const [rateLimit, rateLimitFrom] = pick<RateLimitSettings | null>(
    [
      ['connection_override', co?.rateLimit],
      ['workspace_override', wo?.rateLimit],
      ['connection', layers.connection?.rateLimit],
      ['workspace', layers.workspace.rateLimit],
    ],
    null,
  )
  return {
    rates,
    rules,
    latency,
    openRate,
    clickRate,
    chaos,
    rateLimit,
    sources: {
      rates: ratesFrom,
      rules: rulesFrom,
      latency: latencyFrom,
      openRate: openFrom,
      clickRate: clickFrom,
      chaos: chaosFrom,
      rateLimit: rateLimitFrom,
    },
    overrideIds: {
      workspace: layers.workspaceOverride?.id ?? null,
      connection: layers.connectionOverride?.id ?? null,
    },
  }
}

/** The simulation part only (`OverrideState.effective`). */
export function toSimulationSettings(settings: EffectiveSettings): SimulationSettings {
  const { rates, rules, latency, openRate, clickRate } = settings
  return { rates, rules, latency, openRate, clickRate }
}
