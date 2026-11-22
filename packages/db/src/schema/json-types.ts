// JSON column shapes the contracts do not describe. Settings, overrides and addresses use
// the types inferred from the Zod schemas of @mailsink/contracts (type-only imports, so the
// db package has no runtime dependency on Zod).

export interface TranscriptLine {
  at: number
  dir: 'C' | 'S'
  line: string
}
