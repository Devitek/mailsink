const PREFIX = '#/components/schemas/'
const OUTPUT = 'Output'

type WithSchemas = { components?: { schemas?: Record<string, unknown> } }

function refsIn(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) for (const item of value) refsIn(item, found)
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key === '$ref' && typeof item === 'string' && item.startsWith(PREFIX)) {
        found.push(item.slice(PREFIX.length))
      } else refsIn(item, found)
    }
  }
  return found
}

/**
 * zod-openapi renders every named component in both directions, so a response-only view
 * also gets an unused input twin and its used `…Output` variant. Drops the schemas nothing
 * reaches (except `keep`) and gives an `…Output` variant the plain name when it is free.
 */
export function pruneSchemas<T extends WithSchemas>(document: T, keep: readonly string[]): T {
  const schemas = document.components?.schemas ?? {}
  const reached = new Set<string>()
  const queue = [...refsIn({ ...document, components: { ...document.components, schemas: {} } })]
  queue.push(...keep)
  for (let name = queue.pop(); name !== undefined; name = queue.pop()) {
    if (reached.has(name) || !(name in schemas)) continue
    reached.add(name)
    queue.push(...refsIn(schemas[name]))
  }
  const rename = (name: string) => {
    const base = name.endsWith(OUTPUT) ? name.slice(0, -OUTPUT.length) : name
    return base !== name && !reached.has(base) ? base : name
  }
  const kept: Record<string, unknown> = {}
  for (const [name, schema] of Object.entries(schemas)) {
    if (reached.has(name)) kept[rename(name)] = schema
  }
  let json = JSON.stringify({ ...document, components: { ...document.components, schemas: kept } })
  for (const name of reached) {
    if (rename(name) !== name) {
      json = json.replaceAll(`"${PREFIX}${name}"`, `"${PREFIX}${rename(name)}"`)
    }
  }
  return JSON.parse(json) as T
}
