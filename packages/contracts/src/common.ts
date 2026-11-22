import { z } from 'zod'

/**
 * Refinement options carrying an English message (D19) and a stable machine-readable code
 * in `params.code`, so the UI can map it to a translated label.
 */
export function issue(code: string, message: string, path?: PropertyKey[]) {
  return { message, path, params: { code } }
}

/** Stable code of a custom issue raised by these contracts, if any. */
export function issueCode(zodIssue: z.core.$ZodIssue | undefined): string | undefined {
  if (zodIssue?.code !== 'custom') return undefined
  const code = zodIssue.params?.code
  return typeof code === 'string' ? code : undefined
}

/** Lower-cased e-mail address. */
export const Email = z.email().transform((e) => e.toLowerCase())

export const Slug = z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/, 'Invalid slug')

const UNIT_SECONDS = { s: 1, m: 60, h: 3_600, d: 86_400 } as const
const DURATION_RE = /^(\d+)(s|m|h|d)$/

/** "90s" | "30m" | "1h" | "7d" -> seconds, or null when the string is not a duration. */
export function parseDuration(input: string): number | null {
  const match = DURATION_RE.exec(input)
  if (!match) return null
  const [, amount, unit] = match
  return Number(amount) * UNIT_SECONDS[unit as keyof typeof UNIT_SECONDS]
}

/** Positive integer seconds, or a string such as "1h" or "7d". Output: seconds. */
export const Duration = z.union([z.number(), z.string()]).transform((value, ctx) => {
  const seconds = typeof value === 'number' ? value : parseDuration(value)
  if (seconds === null || !Number.isSafeInteger(seconds) || seconds <= 0) {
    ctx.issues.push({
      code: 'custom',
      input: value,
      message: 'Expected positive integer seconds or a duration such as "30m", "1h" or "7d"',
      params: { code: 'invalid_duration' },
    })
    return z.NEVER
  }
  return seconds
})

/** Boolean from a query string ("true", "1", "yes"…) or from a router that already parsed it. */
export const QueryBool = z.union([z.boolean(), z.stringbool()])

export const IsoDateTime = z.iso.datetime({ offset: true })

export const Tag = z.object({
  name: z.string().regex(/^[\w-]{1,256}$/, 'Tag names use letters, digits, "_" and "-"'),
  value: z.string().max(256),
})

/** Cursor pagination envelope shared by every list endpoint. */
export function Page<T extends z.ZodType>(item: T) {
  return z.object({ data: z.array(item), nextCursor: z.string().nullable() })
}

export const PageLimit = z.coerce.number().int().min(1).max(200).default(50)

export type Duration = z.output<typeof Duration>
export type Tag = z.output<typeof Tag>
