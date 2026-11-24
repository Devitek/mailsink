import type { CreateWorkspaceInput } from '@devitek/mailsink'

type ConnectionInput = NonNullable<CreateWorkspaceInput['connections']>[number]

/**
 * Worker-scoped option `mailsinkOptions`: how each worker's ephemeral workspace is
 * created. Every key is optional; set it in `playwright.config.ts` (`use`) or with
 * `test.use()` at the top of a file.
 */
export interface MailsinkWorkspaceOptions {
  /** Base URL of the Mailsink server. Default: `MAILSINK_URL`. */
  url?: string
  /** Admin key (creates and deletes the workspace). Default: `MAILSINK_ADMIN_KEY`. */
  adminKey?: string
  /** Workspace name. Default: `playwright-w<workerIndex>`; the slug gets a random suffix. */
  name?: string
  /** Connections of the workspace. Default: one Resend connection named `app`. */
  connections?: ConnectionInput[]
  /**
   * Safety net: the server deletes the workspace this many seconds after its last call
   * when the worker never reaches its teardown (killed run). Default 600 (60 to 2 592 000).
   */
  idleTtlSeconds?: number
  /** Brevo templates seeded with the workspace (`templateId` sends). */
  templates?: CreateWorkspaceInput['templates']
  /** Free metadata shown by the web UI; `createdBy` defaults to the worker. */
  metadata?: Record<string, string>
  /** Any other field of `POST /admin/workspaces` (`simulation`, `rateLimit`, `retention`...). */
  workspace?: Omit<CreateWorkspaceInput, 'name' | 'ephemeral' | 'connections'>
  /** Validate every answer against its contract (SDK option). Default false. */
  validate?: boolean
}

export interface ResolvedWorkspaceOptions {
  url: string
  adminKey: string
  validate: boolean
  input: CreateWorkspaceInput
}

export const DEFAULT_IDLE_TTL_SECONDS = 600
export const DEFAULT_CONNECTIONS: ConnectionInput[] = [{ kind: 'resend', name: 'app' }]

type Env = Record<string, string | undefined>

/** Applies the defaults (environment included); throws when the URL or the admin key lacks. */
export function resolveWorkspaceOptions(
  options: MailsinkWorkspaceOptions,
  context: { workerIndex: number; env?: Env },
): ResolvedWorkspaceOptions {
  const env = context.env ?? {}
  const url = options.url ?? env.MAILSINK_URL
  const adminKey = options.adminKey ?? env.MAILSINK_ADMIN_KEY
  if (!url) throw new Error(missing('url', 'MAILSINK_URL'))
  if (!adminKey) throw new Error(missing('adminKey', 'MAILSINK_ADMIN_KEY'))
  const worker = `worker ${context.workerIndex}`
  return {
    url,
    adminKey,
    validate: options.validate ?? false,
    input: {
      ...options.workspace,
      name: options.name ?? `playwright-w${context.workerIndex}`,
      ephemeral: true,
      idleTtlSeconds: options.idleTtlSeconds ?? DEFAULT_IDLE_TTL_SECONDS,
      metadata: { createdBy: `playwright · ${worker}`, ...options.metadata },
      connections: options.connections ?? DEFAULT_CONNECTIONS,
      ...(options.templates ? { templates: options.templates } : {}),
    },
  }
}

function missing(option: string, variable: string): string {
  return (
    `Mailsink: no ${option}. Set ${variable}, or the \`mailsinkOptions\` option ` +
    `(\`use: { mailsinkOptions: { ${option}: ... } }\` in playwright.config.ts).`
  )
}
