// Connection settings of the piloting commands: flags first, then the environment
// (MAILSINK_URL, MAILSINK_ADMIN_KEY, MAILSINK_KEY, MAILSINK_WORKSPACE).
import { createMailsink, type Mailsink } from '@devitek/mailsink'
import { UsageError } from './errors'

export type Env = Record<string, string | undefined>

export const DEFAULT_MAILSINK_URL = 'http://localhost:3000'

/** `parseArgs` options shared by every piloting command. */
export const CLIENT_OPTIONS = {
  url: { type: 'string' },
  'admin-key': { type: 'string' },
  key: { type: 'string' },
  workspace: { type: 'string' },
  json: { type: 'boolean', default: false },
} as const

export interface ClientFlags {
  url?: string
  'admin-key'?: string
  key?: string
  workspace?: string
}

export interface Settings {
  url: string
  adminKey?: string
  key?: string
  workspace?: string
}

export function resolveSettings(flags: ClientFlags, env: Env): Settings {
  const url = flags.url ?? env.MAILSINK_URL ?? DEFAULT_MAILSINK_URL
  if (!URL.canParse(url) || !/^https?:$/.test(new URL(url).protocol)) {
    throw new UsageError('Invalid MAILSINK_URL: expected an http(s) URL')
  }
  return {
    url,
    adminKey: flags['admin-key'] ?? env.MAILSINK_ADMIN_KEY,
    key: flags.key ?? env.MAILSINK_KEY,
    workspace: flags.workspace ?? env.MAILSINK_WORKSPACE,
  }
}

/** Client for the Admin API (`workspace` commands): needs the Admin key. */
export function adminClient(settings: Settings): Mailsink {
  if (!settings.adminKey) {
    throw new UsageError('MAILSINK_ADMIN_KEY (or --admin-key) is required')
  }
  return createMailsink({ url: settings.url, adminKey: settings.adminKey })
}

/**
 * Client for the Capture API of one workspace: a workspace or connection key, or the
 * Admin key with the workspace id or slug.
 */
export function workspaceClient(settings: Settings): Mailsink {
  if (settings.key) {
    return createMailsink({ url: settings.url, key: settings.key, workspace: settings.workspace })
  }
  if (settings.adminKey && settings.workspace) {
    return createMailsink({
      url: settings.url,
      adminKey: settings.adminKey,
      workspace: settings.workspace,
    })
  }
  throw new UsageError(
    'MAILSINK_KEY (or --key) is required, or MAILSINK_ADMIN_KEY with MAILSINK_WORKSPACE',
  )
}
