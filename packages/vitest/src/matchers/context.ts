// The part of the matcher context (`this`) both Vitest and Jest give to `expect.extend`
// matchers, so the matchers depend on neither.
export interface MatcherContext {
  isNot: boolean
}

export interface MatcherResult {
  pass: boolean
  message: () => string
}
