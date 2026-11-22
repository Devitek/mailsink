import { z } from 'zod'

export type ParsedAddress = { email: string; name?: string }

const EmailCheck = z.email()
const ANGLE_RE = /^(.*?)\s*<([^<>]+)>$/

function unquote(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\(.)/g, '$1').trim()
  }
  return trimmed
}

/**
 * Parses "jane@x.io", "Jane <jane@x.io>" or "\"Doe, Jane\" <jane@x.io>".
 * Returns null when the e-mail part is invalid. The e-mail is lower-cased.
 */
export function parseAddress(input: string): ParsedAddress | null {
  const raw = input.trim()
  const match = ANGLE_RE.exec(raw)
  const email = (match ? (match[2] ?? '') : raw).trim()
  if (!EmailCheck.safeParse(email).success) return null
  const name = match ? unquote(match[1] ?? '') : ''
  return name ? { email: email.toLowerCase(), name } : { email: email.toLowerCase() }
}

const AddressObject = z.object({ email: z.string(), name: z.string().optional() })

function fromObject(value: z.output<typeof AddressObject>): ParsedAddress | null {
  const parsed = parseAddress(value.email)
  if (!parsed || parsed.name) return null
  const name = value.name?.trim()
  return name ? { ...parsed, name } : parsed
}

/** "Jane <jane@x.io>" | "jane@x.io" | { email, name? } -> { email, name? } */
export const Address = z.union([z.string(), AddressObject]).transform((value, ctx) => {
  const parsed = typeof value === 'string' ? parseAddress(value) : fromObject(value)
  if (!parsed) {
    ctx.issues.push({
      code: 'custom',
      input: value,
      message: 'Invalid address, expected "jane@x.io" or "Jane <jane@x.io>"',
      params: { code: 'invalid_address' },
    })
    return z.NEVER
  }
  return parsed
})

/** One address or an array of addresses, always output as an array. */
export const AddressList = z
  .union([Address, z.array(Address)])
  .transform((v) => (Array.isArray(v) ? v : [v]))

/** Address as returned by the API (keys always present). */
export const AddressOut = z.object({ email: z.string(), name: z.string().nullable() })

export type Address = z.output<typeof Address>
export type AddressOut = z.output<typeof AddressOut>
