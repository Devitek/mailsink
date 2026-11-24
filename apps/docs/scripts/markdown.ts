// Small Markdown helpers for the sync script: title, README sections, frontmatter.

/** Splits the lines of a document, flagging those inside fenced code blocks. */
function lines(markdown: string): { text: string; code: boolean }[] {
  let fence: string | null = null
  return markdown.split('\n').map((text) => {
    const marker = /^\s*(`{3,}|~{3,})/.exec(text)?.[1]
    if (marker && (fence === null || marker.startsWith(fence))) {
      fence = fence === null ? marker : null
      return { text, code: true }
    }
    return { text, code: fence !== null }
  })
}

/** The first `# ` heading (code spans unwrapped) as title, the rest as body. */
export function splitTitle(markdown: string): { title: string; body: string } {
  const all = lines(markdown)
  const index = all.findIndex((line) => !line.code && line.text.startsWith('# '))
  const heading = all[index]
  if (!heading) throw new Error('Markdown source without a "# " title')
  const rest = all.slice(index + 1).map((line) => line.text)
  while (rest[0]?.trim() === '') rest.shift()
  return { title: heading.text.slice(2).replaceAll('`', '').trim(), body: rest.join('\n') }
}

/**
 * The `## ` sections named, in document order, nested headings included. The empty name
 * is the text before the first section. Throws on a missing section.
 */
export function pickSections(markdown: string, names: readonly string[]): string {
  const sections = new Map<string, string[]>([['', []]])
  let current = ''
  for (const line of lines(markdown)) {
    if (!line.code && line.text.startsWith('## ')) {
      current = line.text.slice(3).trim()
      sections.set(current, [])
    }
    sections.get(current)?.push(line.text)
  }
  return names
    .map((name) => {
      const section = sections.get(name)
      if (!section) throw new Error(`Markdown section "## ${name}" not found`)
      return section.join('\n').trim()
    })
    .join('\n\n')
}

/** The first fenced code block, fences included. */
export function firstFence(markdown: string): string {
  const all = lines(markdown)
  const start = all.findIndex((line) => line.code)
  const end = all.findIndex((line, index) => index > start && line.code && !all[index + 1]?.code)
  if (start < 0 || end < 0) throw new Error('No fenced code block')
  return all
    .slice(start, end + 1)
    .map((line) => line.text)
    .join('\n')
}

/** YAML frontmatter with JSON values (a JSON scalar or object is valid YAML). */
export function toFrontmatter(fields: Record<string, unknown>): string {
  const body = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join('\n')
  return `---\n${body}\n---\n`
}
