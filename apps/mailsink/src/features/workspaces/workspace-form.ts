import type {
  ConnectionKind,
  CreateWorkspaceRequest,
  RateLimitSettings,
  UpdateWorkspaceRequest,
} from '@mailsink/contracts'
import { z } from 'zod'

// Values, validation and request mapping of the workspace dialogs (#38). Validation
// messages come translated from the component (Lingui), so this module stays pure.

/** Retention presets of the prototype segmented control, in seconds. */
export const RETENTION_PRESETS = { '1h': 3_600, '24h': 86_400, '7d': 604_800, '30d': 2_592_000 }
export type RetentionPreset = keyof typeof RETENTION_PRESETS
export const DEFAULT_RETENTION: RetentionPreset = '7d'

/** Preset matching a stored retention, or the stored seconds as a string when none does. */
export function retentionChoice(seconds: number): string {
  const preset = Object.entries(RETENTION_PRESETS).find(([, value]) => value === seconds)
  return preset ? preset[0] : String(seconds)
}

export function retentionSeconds(choice: string): number {
  return RETENTION_PRESETS[choice as RetentionPreset] ?? Number(choice)
}

/** Requests per second, as typed: empty = unlimited. */
export const rateLimitOf = (value: string): RateLimitSettings | null =>
  value.trim() === '' ? null : { limit: Number(value), windowSeconds: 1 }

/** Shown back in the field; a limit over another window is shown per second, rounded up. */
export const rateLimitText = (rate: RateLimitSettings | null): string =>
  rate ? String(Math.ceil(rate.limit / rate.windowSeconds)) : ''

export type FormMessages = {
  nameRequired: string
  slugInvalid: string
  rateInvalid: string
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}$/
const RATE_RE = /^\s*([1-9]\d{0,5})?\s*$/

const name = (m: Pick<FormMessages, 'nameRequired'>) =>
  z.string().trim().min(1, m.nameRequired).max(80)
const rate = (m: FormMessages) => z.string().regex(RATE_RE, m.rateInvalid)

export type NewWorkspaceValues = {
  name: string
  slug: string
  retention: string
  rateLimit: string
  withConnection: boolean
  kind: ConnectionKind
}

export const newWorkspaceDefaults: NewWorkspaceValues = {
  name: '',
  slug: '',
  retention: DEFAULT_RETENTION,
  rateLimit: '',
  withConnection: false,
  kind: 'resend',
}

export const newWorkspaceSchema = (m: FormMessages) =>
  z.object({
    name: name(m),
    slug: z.string().refine((s) => s === '' || SLUG_RE.test(s), m.slugInvalid),
    retention: z.string(),
    rateLimit: rate(m),
    withConnection: z.boolean(),
    kind: z.enum(['resend', 'brevo', 'smtp']),
  })

/** A persistent workspace; the optional first connection is named after its kind. */
export function toCreateRequest(
  values: NewWorkspaceValues,
): z.input<typeof CreateWorkspaceRequest> {
  const rateLimit = rateLimitOf(values.rateLimit)
  return {
    name: values.name.trim(),
    slug: values.slug || undefined,
    ephemeral: false,
    retention: retentionSeconds(values.retention),
    ...(rateLimit ? { rateLimit } : {}),
    connections: values.withConnection ? [{ kind: values.kind, name: values.kind }] : [],
  }
}

/**
 * « Edit » of the workspace card: name and description only. The defaults (retention,
 * quota, rate limit, simulation) have one place, the settings page (#112).
 */
export type EditWorkspaceValues = {
  name: string
  description: string
}

export const editWorkspaceSchema = (m: Pick<FormMessages, 'nameRequired'>) =>
  z.object({
    name: name(m),
    description: z.string().max(500),
  })

export function toUpdateRequest(
  values: EditWorkspaceValues,
): z.input<typeof UpdateWorkspaceRequest> {
  return {
    name: values.name.trim(),
    description: values.description.trim() || null,
  }
}
