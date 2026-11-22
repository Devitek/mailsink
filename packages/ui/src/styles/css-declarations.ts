// Minimal CSS reader for the token tests: innermost `selector { declarations }` blocks only,
// which is all tokens.css and theme.css contain. Values are normalised so that formatting
// (Biome) never counts as a change.

export type Declarations = Record<string, string>

export function declarationsBySelector(css: string): Record<string, Declarations> {
  const result: Record<string, Declarations> = {}
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const match of source.matchAll(/([^{};]+)\{([^{}]*)\}/g)) {
    const selector = (match[1] ?? '').replace(/\s+/g, '')
    const block: Declarations = result[selector] ?? {}
    result[selector] = block
    for (const declaration of (match[2] ?? '').split(';')) {
      const colon = declaration.indexOf(':')
      if (colon < 0) continue
      const name = declaration.slice(0, colon).trim()
      if (name) block[name] = normaliseValue(declaration.slice(colon + 1))
    }
  }
  return result
}

export function referencedVariables(css: string): Set<string> {
  return new Set(Array.from(css.matchAll(/var\((--[\w-]+)/g), (match) => match[1] ?? ''))
}

// Whitespace, separators and number spelling (.2 / 0.20 / 0.2) are formatting only.
function normaliseValue(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*([/,])\s*/g, '$1')
    .replace(/\d*\.\d+/g, (number) => String(Number(number)))
}
