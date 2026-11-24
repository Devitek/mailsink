// Carries the JSDoc of the contract fields over to the plain SDK types (D260, #146). The
// declaration emitter prints an expanded type without the comments of its properties, so
// the documentation is read from the Zod-derived types through the TypeScript 7 API
// (`typescript/unstable/sync`, which only reads the program here) and written back into the
// emitted text, property by property, at the same path.
import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  API,
  type Checker,
  ObjectFlags,
  type ObjectType,
  type Type,
  TypeFlags,
  type UnionType,
} from 'typescript/unstable/sync'

/** Documentation by property path: `TypeName.field.nested` (arrays and unions are transparent). */
export type TypeDocs = Map<string, string>

const MAX_DEPTH = 12

function walk(checker: Checker, type: Type, path: string, docs: TypeDocs, depth: number): void {
  if (depth > MAX_DEPTH) return
  if (type.flags & TypeFlags.Union) {
    for (const member of (type as UnionType).getTypes())
      walk(checker, member, path, docs, depth + 1)
    return
  }
  if (!(type.flags & TypeFlags.Object)) return
  const name = type.getSymbol()?.name
  if (name === 'Date') return
  const flags = (type as ObjectType).objectFlags
  if (
    flags & ObjectFlags.Reference &&
    (name === 'Array' || name === 'ReadonlyArray' || flags & ObjectFlags.Tuple)
  ) {
    for (const element of checker.getTypeArguments(type as never))
      walk(checker, element, path, docs, depth + 1)
    return
  }
  for (const property of checker.getPropertiesOfType(type)) {
    const key = `${path}.${property.name}`
    const doc = checker.getDocumentationCommentOfSymbol(property).trim()
    if (doc && !docs.has(key)) docs.set(key, doc)
    const propertyType = checker.getTypeOfSymbol(property)
    if (propertyType) walk(checker, propertyType, key, docs, depth + 1)
  }
}

/** The field documentation of each exported type alias `names` of `file`. */
export function contractDocs(tsconfig: string, file: string, names: readonly string[]): TypeDocs {
  const api = new API({ cwd: dirname(tsconfig) })
  try {
    const snapshot = api.updateSnapshot({ openProjects: [tsconfig] })
    const project = snapshot.getProject(tsconfig) ?? snapshot.getProjects()[0]
    if (!project) throw new Error(`No TypeScript project for ${tsconfig}`)
    const { checker } = project
    const text = readFileSync(file, 'utf8')
    const docs: TypeDocs = new Map()
    for (const name of names) {
      const at = text.search(new RegExp(`^export type ${name}\\b`, 'm'))
      const symbol = checker.getSymbolAtPosition(file, at + 'export type '.length)
      if (!symbol) throw new Error(`No symbol for ${name} in ${file}`)
      walk(checker, checker.getDeclaredTypeOfSymbol(symbol), name, docs, 0)
    }
    return docs
  } finally {
    api.close()
  }
}

const PROPERTY = /^(\s*)(?:readonly\s+)?([A-Za-z_$][\w$]*|"[^"]+"|'[^']+')\??:/
const ROOT = /^export declare const (\w+): /

function comment(indent: string, doc: string): string[] {
  const lines = doc.replaceAll('*/', '*\\/').split('\n')
  if (lines.length === 1) return [`${indent}/** ${lines[0]} */`]
  return [
    `${indent}/**`,
    ...lines.map((line) => `${indent} *${line ? ` ${line}` : ''}`),
    `${indent} */`,
  ]
}

/**
 * Inserts the documentation above each property of the emitted declarations
 * (`export declare const Name: { ... };`, one member per line). Each `{` opens the object
 * of the property on its line, or, after a `}` on the same line (`} | {`), of the same
 * property again; an index signature opens an anonymous level.
 */
export function insertDocs(emitted: string, docs: TypeDocs): string {
  const stack: (string | null)[] = []
  const out: string[] = []
  for (const line of emitted.split('\n')) {
    const root = ROOT.exec(line)?.[1]
    const property = root ? undefined : PROPERTY.exec(line)
    const name = property?.[2]?.replace(/^["']|["']$/g, '')
    if (property && name !== undefined && stack.length > 0 && !stack.includes(null)) {
      const doc = docs.get([...stack, name].join('.'))
      if (doc) out.push(...comment(property[1] ?? '', doc))
    }
    out.push(line)
    let closed: string | null = null
    for (const char of line.replace(/"[^"]*"|'[^']*'/g, '')) {
      if (char === '}') closed = stack.pop() ?? null
      else if (char === '{')
        stack.push(root ?? name ?? (line.trimStart().startsWith('[') ? null : closed))
    }
  }
  return out.join('\n')
}
