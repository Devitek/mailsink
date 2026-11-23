import { parseArgs } from 'node:util'
import { mcpCommand } from './commands/mcp'
import { migrateCommand } from './commands/migrate'

export interface Io {
  out(line: string): void
  err(line: string): void
}

export type Env = Record<string, string | undefined>

export const DEFAULT_MAILSINK_URL = 'http://localhost:3000'

const USAGE = `Usage: mailsink <command> [options]

Commands:
  mailsink migrate [--database-url <url>]   Apply pending database migrations
  mailsink mcp [--url <url>] [--key <key>] [--workspace <id|slug>]
                                            MCP server on stdio, proxied to <url>/mcp
  mailsink help                             Show this help

DATABASE_URL: postgres://…, pglite://<dir> or pglite://memory (default pglite://./data)
MAILSINK_URL: base URL of the instance (default ${DEFAULT_MAILSINK_URL})
MAILSINK_KEY: workspace key (mskw_…), connection key (msk_…) or the Admin key
MAILSINK_WORKSPACE: workspace id or slug, with the Admin key only`

/** Runs the CLI and returns the process exit code. Never prints a key. */
export async function run(argv: string[], env: Env, io: Io): Promise<number> {
  const [command, ...rest] = argv
  try {
    switch (command) {
      case undefined:
      case 'help':
      case '--help':
      case '-h':
        io.out(USAGE)
        return 0
      case 'migrate': {
        const { values } = parseArgs({
          args: rest,
          options: { 'database-url': { type: 'string' } },
          strict: true,
        })
        await migrateCommand({ databaseUrl: values['database-url'] ?? env.DATABASE_URL }, io)
        return 0
      }
      case 'mcp': {
        const { values } = parseArgs({
          args: rest,
          options: {
            url: { type: 'string' },
            key: { type: 'string' },
            workspace: { type: 'string' },
          },
          strict: true,
        })
        const key = values.key ?? env.MAILSINK_KEY
        if (!key) throw new Error('MAILSINK_KEY (or --key) is required')
        await mcpCommand(
          {
            url: values.url ?? env.MAILSINK_URL ?? DEFAULT_MAILSINK_URL,
            key,
            workspace: values.workspace ?? env.MAILSINK_WORKSPACE,
          },
          io,
        )
        return 0
      }
      default:
        io.err(`Unknown command "${command}".\n\n${USAGE}`)
        return 1
    }
  } catch (error) {
    io.err(error instanceof Error ? error.message : String(error))
    return 1
  }
}
