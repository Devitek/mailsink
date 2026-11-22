import { issueCode } from '@mailsink/contracts'
import { DomainError } from '@mailsink/core'
import type { z } from 'zod'

export type InputSource = 'params' | 'query' | 'body'

export type ValidationIssue = {
  path: (string | number)[]
  code: string
  message: string
  /** Stable code of a contracts refinement (`issue()` helper of @mailsink/contracts). */
  params?: { code: string }
}

/** `details` of a `validation_error`: where the input failed and the Zod issues. */
export type ValidationDetails = { in: InputSource; issues: ValidationIssue[] }

function toIssue(issue: z.core.$ZodIssue): ValidationIssue {
  const stable = issueCode(issue)
  return {
    path: issue.path.map((key) => (typeof key === 'number' ? key : String(key))),
    code: issue.code,
    message: issue.message,
    ...(stable ? { params: { code: stable } } : {}),
  }
}

/** Parses one input or throws a 422 `validation_error` (input values are never echoed). */
export async function parseInput<S extends z.ZodType>(
  schema: S,
  value: unknown,
  source: InputSource,
): Promise<z.output<S>> {
  const result = await schema.safeParseAsync(value, { reportInput: false })
  if (result.success) return result.data
  const details: ValidationDetails = { in: source, issues: result.error.issues.map(toIssue) }
  throw new DomainError('validation_error', `Invalid request ${source}`, { details })
}

/** Search params as a record; a repeated key becomes an array. */
export function queryObject(url: URL): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  for (const [key, value] of url.searchParams) {
    const prev = out[key]
    out[key] = prev === undefined ? value : Array.isArray(prev) ? [...prev, value] : [prev, value]
  }
  return out
}

/** JSON body, `undefined` when empty; unreadable JSON is a 400 `validation_error`. */
export async function readJsonBody(request: Request): Promise<unknown> {
  const text = await request.text()
  if (text.trim() === '') return undefined
  try {
    return JSON.parse(text)
  } catch {
    throw new DomainError('validation_error', 'Request body is not valid JSON', {
      status: 400,
      details: { in: 'body', issues: [] } satisfies ValidationDetails,
    })
  }
}
