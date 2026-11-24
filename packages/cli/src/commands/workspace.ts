// `mailsink workspace create|list|delete` (Admin API).
import { parseArgs } from 'node:util'
import type { CreateWorkspaceResult, Workspace } from '@devitek/mailsink'
import { adminClient, CLIENT_OPTIONS, type Env, resolveSettings } from '../config'
import { UsageError } from '../errors'
import { envLines, type Io, printJson, table } from '../output'
import { parseConnection, parseDurationSeconds } from '../parse'

export const DEFAULT_WORKSPACE_NAME = 'mailsink-cli'

export async function workspaceCommand(argv: string[], env: Env, io: Io): Promise<void> {
  const [action, ...rest] = argv
  switch (action) {
    case 'create':
      return create(rest, env, io)
    case 'list':
      return list(rest, env, io)
    case 'delete':
      return remove(rest, env, io)
    default:
      throw new UsageError(
        action === undefined
          ? 'mailsink workspace: expected create, list or delete'
          : `Unknown workspace action "${action}": expected create, list or delete`,
      )
  }
}

async function create(args: string[], env: Env, io: Io): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      ...CLIENT_OPTIONS,
      name: { type: 'string', default: DEFAULT_WORKSPACE_NAME },
      slug: { type: 'string' },
      ephemeral: { type: 'boolean', default: false },
      ttl: { type: 'string' },
      retention: { type: 'string' },
      connection: { type: 'string', multiple: true, default: [] },
    },
    strict: true,
  })
  if (values.ttl !== undefined && !values.ephemeral) {
    throw new UsageError('--ttl requires --ephemeral')
  }
  const settings = resolveSettings(values, env)
  const created = await adminClient(settings).admin.workspaces.create({
    name: values.name,
    slug: values.slug,
    ephemeral: values.ephemeral,
    idleTtlSeconds: values.ttl === undefined ? undefined : parseDurationSeconds(values.ttl, 'ttl'),
    retention:
      values.retention === undefined
        ? undefined
        : parseDurationSeconds(values.retention, 'retention'),
    connections: values.connection.map(parseConnection),
  })
  if (values.json) return printJson(io, created)
  io.out(credentialsEnv(settings.url, created))
}

/**
 * The credentials as `.env` lines, ready for `>> "$GITHUB_ENV"` or `export $(…)`: the
 * workspace, its `mskw_` key as MAILSINK_KEY, then each connection's snippet.
 */
export function credentialsEnv(url: string, created: CreateWorkspaceResult): string {
  const head = envLines([
    ['MAILSINK_URL', url],
    ['MAILSINK_WORKSPACE_ID', created.workspace.id],
    ['MAILSINK_WORKSPACE_SLUG', created.workspace.slug],
    ['MAILSINK_KEY', created.workspaceKey],
  ])
  const snippets = created.connections.map((c) => c.envSnippet.trimEnd())
  return [head, ...snippets].join('\n')
}

async function list(args: string[], env: Env, io: Io): Promise<void> {
  const { values } = parseArgs({
    args,
    options: { ...CLIENT_OPTIONS, ephemeral: { type: 'boolean', default: false } },
    strict: true,
  })
  const client = adminClient(resolveSettings(values, env))
  const workspaces: Workspace[] = []
  let cursor: string | undefined
  do {
    const page = await client.admin.workspaces.list({
      includeEphemeral: values.ephemeral,
      cursor,
      limit: 200,
    })
    workspaces.push(...page.data)
    cursor = page.nextCursor ?? undefined
  } while (cursor)
  if (values.json) return printJson(io, workspaces)
  if (workspaces.length === 0) return io.out('No workspace.')
  io.out(
    table(
      ['ID', 'SLUG', 'EPHEMERAL', 'EXPIRES', 'NAME'],
      workspaces.map((w) => [w.id, w.slug, w.ephemeral ? 'yes' : 'no', w.expiresAt, w.name]),
    ),
  )
}

async function remove(args: string[], env: Env, io: Io): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: CLIENT_OPTIONS,
    allowPositionals: true,
    strict: true,
  })
  if (positionals.length === 0) {
    throw new UsageError('mailsink workspace delete: expected at least one <id|slug>')
  }
  const client = adminClient(resolveSettings(values, env))
  for (const ref of positionals) await client.admin.workspaces.delete(ref)
  if (values.json) return printJson(io, { deleted: positionals })
  for (const ref of positionals) io.out(`Deleted workspace ${ref}.`)
}
