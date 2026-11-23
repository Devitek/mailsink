/**
 * Safe renderer for the Brevo placeholders `{{ params.x }}` and `{{ contact.X }}` (#29).
 * No code is ever evaluated: a placeholder is a dotted path into `params` or `contact`,
 * optionally followed by filters (`default: "x"`, `upper`, `lower`, `safe`). Only own
 * properties of plain objects and numeric indexes of arrays are read, so `constructor`
 * or `__proto__` resolve to nothing. An unknown variable renders as an empty string, as
 * Brevo does. Any other tag (`{{ unsubscribe }}`, `{% if %}` blocks, expressions) is left
 * verbatim. In html mode values are HTML-escaped unless the `safe` filter is applied.
 */
export interface RenderContext {
  params: Record<string, unknown>
  contact: Record<string, unknown>
}

export interface RenderOptions {
  /** Escape the inserted values (html bodies). */
  html?: boolean
}

const TAG_RE = /\{\{\s*((?:params|contact)(?:\.[\w-]+)+)\s*((?:\|[^|{}]*)*)\}\}/g
const FILTER_RE = /^\s*(\w+)\s*(?::\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?\s*$/

function lookup(root: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = root
  for (const key of path) {
    if (Array.isArray(current)) {
      current = /^\d+$/.test(key) ? current[Number(key)] : undefined
    } else if (isPlainObject(current) && Object.hasOwn(current, key)) {
      current = current[key]
    } else {
      return undefined
    }
  }
  return current
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function format(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  return JSON.stringify(value) ?? ''
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}
const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c)

/** Applies the filters; null when one of them is unknown (the tag is then left verbatim). */
function applyFilters(value: unknown, filters: string): { text: string; safe: boolean } | null {
  let text = format(value)
  let safe = false
  for (const raw of filters.split('|').slice(1)) {
    const match = FILTER_RE.exec(raw)
    if (!match) return null
    const [, name, dq, sq, bare] = match
    if (name === 'default') text = text === '' ? (dq ?? sq ?? bare ?? '') : text
    else if (name === 'upper') text = text.toUpperCase()
    else if (name === 'lower') text = text.toLowerCase()
    else if (name === 'safe') safe = true
    else return null
  }
  return { text, safe }
}

export function renderTemplate(
  source: string,
  context: RenderContext,
  options: RenderOptions = {},
): string {
  return source.replace(TAG_RE, (tag, expression: string, filters: string) => {
    const [root, ...path] = expression.split('.')
    const value = lookup(root === 'params' ? context.params : context.contact, path)
    const rendered = applyFilters(value, filters)
    if (!rendered) return tag
    return options.html && !rendered.safe ? escapeHtml(rendered.text) : rendered.text
  })
}
