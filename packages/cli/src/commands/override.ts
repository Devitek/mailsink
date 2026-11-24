// `mailsink override set|reset`: temporary simulation settings of a workspace or connection.
import { parseArgs } from 'node:util'
import type { OverrideConfig, OverrideState } from '@devitek/mailsink'
import { CLIENT_OPTIONS, type Env, resolveSettings, workspaceClient } from '../config'
import { UsageError } from '../errors'
import { type Io, printJson } from '../output'
import { parseDurationSeconds, parseLatency, parsePercent, parseRule } from '../parse'

/** Status rate flags: `--hard-bounce 20` = 20 % of the messages end hard bounced. */
export const RATE_FLAGS = {
  delivered: 'delivered',
  deferred: 'deferred',
  'soft-bounce': 'soft_bounce',
  'hard-bounce': 'hard_bounce',
  complained: 'complained',
  failed: 'failed',
  invalid: 'invalid',
} as const

type RateFlag = keyof typeof RATE_FLAGS

const rateOptions = Object.fromEntries(
  Object.keys(RATE_FLAGS).map((flag) => [flag, { type: 'string' }]),
) as Record<RateFlag, { type: 'string' }>

export async function overrideCommand(argv: string[], env: Env, io: Io): Promise<void> {
  const [action, ...rest] = argv
  if (action === 'set') return set(rest, env, io)
  if (action === 'reset') return reset(rest, env, io)
  throw new UsageError(
    action === undefined
      ? 'mailsink override: expected set or reset'
      : `Unknown override action "${action}": expected set or reset`,
  )
}

async function set(args: string[], env: Env, io: Io): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      ...CLIENT_OPTIONS,
      ...rateOptions,
      latency: { type: 'string' },
      'error-rate': { type: 'string' },
      rule: { type: 'string', multiple: true, default: [] },
      config: { type: 'string' },
      ttl: { type: 'string' },
      connection: { type: 'string' },
    },
    strict: true,
  })
  const config = buildConfig(values)
  if (Object.keys(config).length === 0) {
    throw new UsageError('mailsink override set: give at least one setting (see --help)')
  }
  const client = workspaceClient(resolveSettings(values, env))
  const state = await client.overrides.activate(config, {
    connectionId: values.connection,
    ttl: values.ttl === undefined ? undefined : parseDurationSeconds(values.ttl, 'ttl'),
  })
  if (values.json) return printJson(io, state)
  io.out(describeActive(state, values.connection))
}

type SetValues = Partial<Record<RateFlag | 'latency' | 'error-rate' | 'config', string>> & {
  rule: string[]
}

/** The override body: `--config` JSON first, then the flags on top of it. */
export function buildConfig(values: SetValues): OverrideConfig {
  let config: Record<string, unknown> = {}
  if (values.config !== undefined) {
    try {
      config = JSON.parse(values.config) as Record<string, unknown>
    } catch {
      throw new UsageError('--config: expected a JSON object')
    }
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new UsageError('--config: expected a JSON object')
    }
  }
  const rates: Record<string, number> = { ...(config.rates as object) }
  for (const flag of Object.keys(RATE_FLAGS) as RateFlag[]) {
    const value = values[flag]
    if (value !== undefined) rates[RATE_FLAGS[flag]] = parsePercent(value, flag)
  }
  if (Object.keys(rates).length > 0) config.rates = rates
  if (values.latency !== undefined) config.latency = parseLatency(values.latency)
  if (values['error-rate'] !== undefined) {
    config.chaos = {
      ...(config.chaos as object),
      errorRate: parsePercent(values['error-rate'], 'error-rate'),
    }
  }
  if (values.rule.length > 0) {
    config.rules = [...((config.rules as unknown[]) ?? []), ...values.rule.map(parseRule)]
  }
  return config as OverrideConfig
}

async function reset(args: string[], env: Env, io: Io): Promise<void> {
  const { values } = parseArgs({
    args,
    options: { ...CLIENT_OPTIONS, connection: { type: 'string' } },
    strict: true,
  })
  const client = workspaceClient(resolveSettings(values, env))
  const state = await client.overrides.reset({ connectionId: values.connection })
  if (values.json) return printJson(io, state)
  io.out(
    `Override reset on ${values.connection ? `connection ${values.connection}` : 'the workspace'}.`,
  )
}

function describeActive(state: OverrideState, connectionId: string | undefined): string {
  const active = connectionId
    ? state.connections.find((o) => o.connectionId === connectionId)
    : state.workspace
  const scope = connectionId ? `connection ${connectionId}` : 'the workspace'
  const until = active?.expiresAt ? `, until ${active.expiresAt}` : ''
  return `Override active on ${scope}${until}: ${JSON.stringify(active?.config ?? {})}`
}
