import type { Mailsink } from '@devitek/mailsink'

/** What the `mailsink` fixture clears before each test (option `mailsinkReset`). */
export interface ResetOptions {
  /** Delete the messages (and their logs). Default true. */
  messages?: boolean
  /** Reset every active override, workspace-wide and per connection. Default true. */
  overrides?: boolean
  /** Empty the suppression list (bounced and complained addresses). Default true. */
  suppressions?: boolean
}

/** Resets every active override of the workspace: the workspace scope and each connection. */
export async function resetOverrides(client: Mailsink): Promise<void> {
  const state = await client.overrides.get()
  await Promise.all([
    ...(state.workspace ? [client.overrides.reset()] : []),
    ...state.connections.flatMap((o) =>
      o.connectionId ? [client.overrides.reset({ connectionId: o.connectionId })] : [],
    ),
  ])
}

/** Back to a blank workspace: by default no message, no override, no suppression. */
export async function resetWorkspace(
  client: Mailsink,
  options: ResetOptions | boolean = true,
): Promise<void> {
  if (options === false) return
  const { messages = true, overrides = true, suppressions = true } = options === true ? {} : options
  await Promise.all([
    messages ? client.messages.purge() : undefined,
    overrides ? resetOverrides(client) : undefined,
    suppressions ? client.suppressions.clear() : undefined,
  ])
}
