// `mailsink purge`: deletes the captured messages of a workspace (and their logs).
import { parseArgs } from 'node:util'
import { CLIENT_OPTIONS, type Env, resolveSettings, workspaceClient } from '../config'
import { UsageError } from '../errors'
import { type Io, printJson } from '../output'

export async function purgeCommand(args: string[], env: Env, io: Io): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      ...CLIENT_OPTIONS,
      connection: { type: 'string' },
      before: { type: 'string' },
      'keep-logs': { type: 'boolean', default: false },
    },
    strict: true,
  })
  let before: string | undefined
  if (values.before !== undefined) {
    const date = new Date(values.before)
    if (Number.isNaN(date.getTime())) throw new UsageError('--before: expected an ISO date')
    before = date.toISOString()
  }
  const client = workspaceClient(resolveSettings(values, env))
  const result = await client.messages.purge({
    connectionId: values.connection,
    before,
    includeLogs: !values['keep-logs'],
  })
  if (values.json) return printJson(io, result)
  io.out(`Purged ${result.count} message${result.count === 1 ? '' : 's'}.`)
}
