import { issueCode } from '@mailsink/contracts'
import { DomainError, isDomainError } from '@mailsink/core'
import type { CallToolResult } from '@modelcontextprotocol/server'
import type { z } from 'zod'

/** A tool answer: the JSON as text (every client reads it) and as structured content. */
export function jsonResult(value: unknown): CallToolResult {
  const structured =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : { value }
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    structuredContent: structured,
  }
}

/**
 * A failed tool call (`isError`), with the error body of the HTTP APIs (03-contracts,
 * « Errors »): stable code, English message (D19), details. Anything that is not a
 * `DomainError` is logged and answered as a bare `internal_error`, like `defineApi()`.
 */
export function errorResult(error: unknown, log: Pick<Console, 'error'> = console): CallToolResult {
  const body = isDomainError(error)
    ? {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      }
    : { code: 'internal_error', message: 'Internal error' }
  if (!isDomainError(error)) log.error('[mailsink] MCP tool failed', error)
  return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error: body }) }] }
}

/** Runs a tool body, turning its value or its failure into a tool result. */
export async function runTool(body: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return jsonResult(await body())
  } catch (error) {
    return errorResult(error)
  }
}

/**
 * Parses tool arguments with the full contract schema (defaults, refinements such as
 * `since` before `until`), so a tool validates exactly like its HTTP twin. Throws a
 * `validation_error` whose details mirror the HTTP ones, input values never echoed.
 */
export function parseContract<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value, { reportInput: false })
  if (result.success) return result.data
  const issues = result.error.issues.map((issue) => {
    const stable = issueCode(issue)
    return {
      path: issue.path.map((key) => (typeof key === 'number' ? key : String(key))),
      code: issue.code,
      message: issue.message,
      ...(stable ? { params: { code: stable } } : {}),
    }
  })
  throw new DomainError('validation_error', 'Invalid tool arguments', {
    details: { in: 'arguments', issues },
  })
}
