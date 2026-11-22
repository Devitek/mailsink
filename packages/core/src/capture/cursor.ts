import { MessageId } from '@mailsink/contracts'
import { DomainError } from '../errors'

/** Keyset position of the last row of a page: its created_at (microseconds, UTC) and id. */
export interface MessageCursor {
  createdAt: string
  id: string
}

const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/

/** Opaque, URL-safe cursor. */
export function encodeCursor(cursor: MessageCursor): string {
  return Buffer.from(JSON.stringify([cursor.createdAt, cursor.id])).toString('base64url')
}

/** Throws a 422 `validation_error` (`invalid_cursor`) on anything encodeCursor did not make. */
export function decodeCursor(value: string): MessageCursor {
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
  } catch {
    throw invalidCursor()
  }
  if (!Array.isArray(parsed) || parsed.length !== 2) throw invalidCursor()
  const [createdAt, id] = parsed
  if (typeof createdAt !== 'string' || !TIMESTAMP.test(createdAt)) throw invalidCursor()
  if (!MessageId.safeParse(id).success) throw invalidCursor()
  return { createdAt, id }
}

function invalidCursor(): DomainError {
  return queryError('cursor', 'invalid_cursor', 'Invalid cursor')
}

/** 422 `validation_error` on one query parameter, same `details` shape as schema errors. */
export function queryError(param: string, code: string, message: string): DomainError {
  return new DomainError('validation_error', 'Invalid request query', {
    details: {
      in: 'query',
      issues: [{ path: [param], code: 'custom', message, params: { code } }],
    },
  })
}
