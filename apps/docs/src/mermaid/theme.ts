// Mermaid theme variables from the design tokens (docs/design/brand-1/tokens/tokens.css):
// Mermaid derives shades from literal colors, so CSS variables cannot be passed to it. The
// tokens file stays the only source: each `--ms-*` color is read from its light or dark block
// (the hex value, or the hex comment next to an oklch value).

export type ThemeName = 'light' | 'dark'

const BLOCKS: Record<ThemeName, RegExp> = {
  light: /:root, \[data-theme="light"\] \{([^}]*)\}/,
  dark: /\[data-theme="dark"\] \{([^}]*)\}/,
}

/** The hex colors of one theme block, by token name without `--ms-`. */
export function readColors(css: string, theme: ThemeName): Record<string, string> {
  const block = BLOCKS[theme].exec(css)?.[1]
  if (!block) throw new Error(`tokens.css: no ${theme} theme block`)
  const colors: Record<string, string> = {}
  for (const line of block.split('\n')) {
    const match = /--ms-([a-z0-9-]+):\s*([^;]+);(?:\s*\/\*\s*(#[0-9a-f]{3,8})\s*\*\/)?/i.exec(line)
    if (!match) continue
    const [, name = '', value = '', comment] = match
    const hex = comment ?? (/^#[0-9a-f]{3,8}$/i.test(value.trim()) ? value.trim() : undefined)
    if (hex) colors[name] = hex
  }
  return colors
}

function pick(colors: Record<string, string>, name: string): string {
  const color = colors[name]
  if (!color) throw new Error(`tokens.css: no hex value for --ms-${name}`)
  return color
}

/** Mermaid `base` theme variables mapped onto the tokens of one theme. */
export function themeVariables(css: string, theme: ThemeName): Record<string, string | boolean> {
  const colors = readColors(css, theme)
  const c = (name: string) => pick(colors, name)
  return {
    darkMode: theme === 'dark',
    background: c('bg'),
    fontFamily: 'arial, sans-serif',
    primaryColor: c('panel'),
    primaryTextColor: c('text'),
    primaryBorderColor: c('border-strong'),
    secondaryColor: c('raised'),
    tertiaryColor: c('hover'),
    lineColor: c('text-muted'),
    textColor: c('text'),
    // Sequence diagrams: participants, notes, loop and alt frames.
    actorBkg: c('panel'),
    actorBorder: c('border-strong'),
    actorTextColor: c('text'),
    actorLineColor: c('border-strong'),
    signalColor: c('text'),
    signalTextColor: c('text'),
    labelBoxBkgColor: c('hover'),
    labelBoxBorderColor: c('border-strong'),
    labelTextColor: c('text'),
    loopTextColor: c('text-muted'),
    noteBkgColor: c('accent'),
    noteBorderColor: c('accent'),
    noteTextColor: c('on-accent'),
    activationBkgColor: c('hover'),
    activationBorderColor: c('border-strong'),
    // `autonumber` draws the number in this color on a disc filled with `signalColor`.
    sequenceNumberColor: c('bg'),
    // Entity relationship diagrams: alternating attribute rows.
    attributeBackgroundColorOdd: c('panel'),
    attributeBackgroundColorEven: c('raised'),
  }
}
