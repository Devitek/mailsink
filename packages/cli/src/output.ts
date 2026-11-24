export interface Io {
  out(line: string): void
  err(line: string): void
}

/** `--json`: one pretty-printed JSON document on stdout. */
export function printJson(io: Io, value: unknown): void {
  io.out(JSON.stringify(value, null, 2))
}

/** Left-aligned columns, two spaces apart; `null` and `undefined` print as `-`. */
export function table(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const cells = [headers, ...rows.map((row) => row.map((c) => (c == null ? '-' : String(c))))]
  const widths = headers.map((_, i) => Math.max(...cells.map((row) => row[i]?.length ?? 0)))
  return cells
    .map((row) =>
      row.map((cell, i) => (i === row.length - 1 ? cell : cell.padEnd(widths[i] ?? 0))).join('  '),
    )
    .join('\n')
}

/** `.env` lines (`NAME=value`), skipping absent values; values are printed as is. */
export function envLines(entries: [string, string | number | null | undefined][]): string {
  return entries
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([name, value]) => `${name}=${value}`)
    .join('\n')
}
