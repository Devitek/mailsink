// Option values of the piloting commands: durations, latency ranges, percentages,
// connection specs. Every parser throws a UsageError naming the option.
import { UsageError } from './errors'

const MS_PER_UNIT = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const
const DURATION = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)?$/

/** `"500ms"`, `"5s"`, `"2m"`, `"1h"`, `"1d"`; a bare number is seconds. */
export function parseDurationMs(value: string, option: string): number {
  const match = DURATION.exec(value.trim())
  if (!match) {
    throw new UsageError(`--${option}: expected a duration such as 500ms, 5s, 2m or 1h`)
  }
  const unit = (match[2] ?? 's') as keyof typeof MS_PER_UNIT
  return Math.round(Number(match[1]) * MS_PER_UNIT[unit])
}

/** A duration in whole seconds (the server TTLs), at least one second. */
export function parseDurationSeconds(value: string, option: string): number {
  const ms = parseDurationMs(value, option)
  if (ms < 1_000 || ms % 1_000 !== 0) {
    throw new UsageError(`--${option}: expected whole seconds, such as 90s, 30m or 1h`)
  }
  return ms / 1_000
}

/** `"20"` or `"20%"`, from 0 to 100. */
export function parsePercent(value: string, option: string): number {
  const n = Number(value.trim().replace(/%$/, ''))
  if (value.trim() === '' || !Number.isFinite(n) || n < 0 || n > 100) {
    throw new UsageError(`--${option}: expected a percentage from 0 to 100`)
  }
  return n
}

/** `"100-500"` (ms) or `"200"` for a fixed latency. */
export function parseLatency(value: string): { minMs: number; maxMs: number } {
  const match = /^(\d+)(?:-(\d+))?$/.exec(value.trim())
  const minMs = Number(match?.[1])
  const maxMs = Number(match?.[2] ?? match?.[1])
  if (!match || minMs > maxMs) {
    throw new UsageError('--latency: expected <min>-<max> in ms, such as 100-500')
  }
  return { minMs, maxMs }
}

export const CONNECTION_KINDS = ['resend', 'brevo', 'smtp'] as const
export type ConnectionKind = (typeof CONNECTION_KINDS)[number]

/** `"resend:app"` -> `{ kind: 'resend', name: 'app' }`; the name defaults to the kind. */
export function parseConnection(value: string): { kind: ConnectionKind; name: string } {
  const [kind = '', ...rest] = value.split(':')
  const name = rest.join(':').trim() || kind
  if (!(CONNECTION_KINDS as readonly string[]).includes(kind)) {
    throw new UsageError(
      `--connection: expected <kind>[:<name>] with kind ${CONNECTION_KINDS.join(', ')}`,
    )
  }
  return { kind: kind as ConnectionKind, name }
}

/**
 * `--since`: an ISO date, `now`, or a duration ago (`5m` = five minutes ago). Absent:
 * the epoch, so a message stored before the command started counts.
 */
export function parseSince(value: string | undefined, now = new Date()): Date {
  if (value === undefined) return new Date(0)
  if (value === 'now') return now
  if (DURATION.test(value)) return new Date(now.getTime() - parseDurationMs(value, 'since'))
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new UsageError('--since: expected an ISO date, "now" or a duration such as 5m')
  }
  return date
}

/** `"*+bounce@*=hard_bounce"` -> a recipient rule. */
export function parseRule(value: string): { match: string; status: string } {
  const at = value.lastIndexOf('=')
  const match = value.slice(0, at).trim()
  const status = value.slice(at + 1).trim()
  if (at <= 0 || !match || !status) {
    throw new UsageError('--rule: expected <glob>=<status>, such as "*+bounce@*=hard_bounce"')
  }
  return { match, status }
}
