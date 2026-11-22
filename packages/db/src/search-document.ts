import { type SQL, sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

/**
 * Characters of `subject text html` indexed for the capture full text search. A tsvector is
 * capped at 1 MB by Postgres: without a bound, one large body made every search of its
 * workspace fail. 100 000 characters stay under the cap in the worst case measured
 * (unique two-character CJK words, about 470 kB).
 */
export const SEARCH_DOCUMENT_MAX_CHARS = 100_000

/**
 * The searched document of a message. The GIN index `messages_search_gin` is built on this
 * very expression: a query must use it unchanged for the planner to pick the index.
 */
export function searchDocument(c: {
  subject: AnyPgColumn
  text: AnyPgColumn
  html: AnyPgColumn
}): SQL {
  return sql`to_tsvector('simple', left(${c.subject} || ' ' || coalesce(${c.text}, '') || ' ' ||
    coalesce(${c.html}, ''), ${sql.raw(String(SEARCH_DOCUMENT_MAX_CHARS))}))`
}
