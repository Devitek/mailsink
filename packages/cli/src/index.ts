import { parseArgs } from 'node:util'
import { overrideCommand } from './commands/override'
import { purgeCommand } from './commands/purge'
import { waitCommand } from './commands/wait'
import { workspaceCommand } from './commands/workspace'
import { DEFAULT_MAILSINK_URL, type Env } from './config'
import { describeFailure, EXIT } from './errors'
import type { Io } from './output'
import { USAGE } from './usage'

export { DEFAULT_MAILSINK_URL, type Env } from './config'
export { EXIT } from './errors'
export type { Io } from './output'

/** The database drivers `migrate` needs, optional peers of @devitek/mailsink-cli. */
export const DB_PEERS = ['drizzle-orm', 'pg', '@electric-sql/pglite']

/**
 * `migrate` and `mcp` load lazily: the piloting commands never import the database
 * drivers, which `npx @devitek/mailsink-cli` does not install (D251).
 */
async function loadMigrate() {
  try {
    return await import('./commands/migrate')
  } catch (error) {
    const code = (error as { code?: unknown }).code
    const missing = DB_PEERS.find((name) => String(error).includes(`'${name}`))
    if (code !== 'ERR_MODULE_NOT_FOUND' || !missing) throw error
    throw new Error(
      `mailsink migrate needs ${DB_PEERS.join(', ')} (missing: ${missing}). Run it from ` +
        'the Docker image, or install them next to @devitek/mailsink-cli.',
    )
  }
}

/** Runs the CLI and returns the process exit code. Never prints a key on stderr. */
export async function run(argv: string[], env: Env, io: Io): Promise<number> {
  const [command, ...rest] = argv
  try {
    switch (command) {
      case undefined:
      case 'help':
      case '--help':
      case '-h':
        io.out(USAGE)
        return EXIT.ok
      case 'workspace':
        await workspaceCommand(rest, env, io)
        return EXIT.ok
      case 'wait':
        await waitCommand(rest, env, io)
        return EXIT.ok
      case 'override':
        await overrideCommand(rest, env, io)
        return EXIT.ok
      case 'purge':
        await purgeCommand(rest, env, io)
        return EXIT.ok
      case 'migrate': {
        const { values } = parseArgs({
          args: rest,
          options: { 'database-url': { type: 'string' } },
          strict: true,
        })
        const { migrateCommand } = await loadMigrate()
        await migrateCommand({ databaseUrl: values['database-url'] ?? env.DATABASE_URL }, io)
        return EXIT.ok
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
        const { mcpCommand } = await import('./commands/mcp')
        await mcpCommand(
          {
            url: values.url ?? env.MAILSINK_URL ?? DEFAULT_MAILSINK_URL,
            key,
            workspace: values.workspace ?? env.MAILSINK_WORKSPACE,
          },
          io,
        )
        return EXIT.ok
      }
      default:
        io.err(`Unknown command "${command}".\n\n${USAGE}`)
        return EXIT.usage
    }
  } catch (error) {
    const failure = describeFailure(error)
    io.err(failure.message)
    return failure.code
  }
}
