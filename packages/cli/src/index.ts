import { parseArgs } from 'node:util'
import { migrateCommand } from './commands/migrate'

export interface Io {
  out(line: string): void
  err(line: string): void
}

export type Env = Record<string, string | undefined>

const USAGE = `Usage: mailsink <command> [options]

Commands:
  mailsink migrate [--database-url <url>]   Apply pending database migrations
  mailsink help                             Show this help

DATABASE_URL: postgres://…, pglite://<dir> or pglite://memory (default pglite://./data)`

/** Runs the CLI and returns the process exit code. */
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
      default:
        io.err(`Unknown command "${command}".\n\n${USAGE}`)
        return 1
    }
  } catch (error) {
    io.err(error instanceof Error ? error.message : String(error))
    return 1
  }
}
