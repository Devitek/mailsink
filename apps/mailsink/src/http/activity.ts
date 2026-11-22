import type { ApiExtension } from './extensions'

/**
 * Workspace activity (#20, D16): every call authenticated on a workspace (ingestion with
 * `msk_`, Capture and MCP with any workspace key or the Admin key plus
 * `X-Mailsink-Workspace`) touches it after authentication, extending an ephemeral
 * workspace's `expires_at`. The tracker throttles the writes; Admin-only calls touch
 * nothing.
 */
export const activityExtension: ApiExtension = {
  name: 'activity',
  afterAuth: async ({ runtime, auth }) => {
    if (auth?.kind === 'workspace') await runtime.activity.touch(auth.workspace.id)
  },
}
