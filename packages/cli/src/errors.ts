import { isMailsinkError } from '@devitek/mailsink'

/** Exit codes of every command (docs/guides/cli.md). */
export const EXIT = {
  ok: 0,
  /** The call failed: API error, network, authentication. */
  failure: 1,
  /** Bad command line: unknown command or option, invalid value, missing credential. */
  usage: 2,
  /** `mailsink wait`: no message matched before the timeout. */
  waitTimeout: 3,
} as const

/** A command line mistake, reported with exit code 2. */
export class UsageError extends Error {
  override readonly name = 'UsageError'
}

/** `parseArgs` rejects unknown options and bad values with `ERR_PARSE_ARGS_*` codes. */
function isParseArgsError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' && code.startsWith('ERR_PARSE_ARGS_')
}

/** Exit code and one-line English message of a failure. Never prints a key. */
export function describeFailure(error: unknown): { code: number; message: string } {
  if (error instanceof UsageError || isParseArgsError(error)) {
    return { code: EXIT.usage, message: (error as Error).message }
  }
  if (isMailsinkError(error)) {
    const request = error.requestId ? ` (request ${error.requestId})` : ''
    const code = error.code === 'wait_timeout' ? EXIT.waitTimeout : EXIT.failure
    return { code, message: `${error.code}: ${error.message}${request}` }
  }
  return {
    code: EXIT.failure,
    message: error instanceof Error ? error.message : String(error),
  }
}
