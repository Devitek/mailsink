// Override tools (03-contracts, « Settings and override »): set_override_config,
// reset_override_config and get_override_config (D168). Every change publishes
// the new state (D96), activations are recorded with origin `mcp`.
import { ResetOverrideRequest } from '@mailsink/contracts'
import {
  activateAndPublishOverride,
  getOverrideState,
  resetAndPublishOverride,
} from '@mailsink/core'
import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import type { McpContext } from '../context'
import { runTool } from '../result'
import { SetOverrideInput } from '../schemas'

export function registerOverrideTools(server: McpServer, ctx: McpContext): void {
  server.registerTool(
    'set_override_config',
    {
      title: 'Set a simulation override',
      description:
        'Replaces the active override of the workspace, or of one connection: status rates, ' +
        'recipient rules, latency, chaos, rate limit. ttl (seconds or "10m") resets it ' +
        'automatically. Returns the overrides and the effective settings per connection.',
      inputSchema: SetOverrideInput,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    (request) => runTool(() => activateAndPublishOverride(ctx, ctx.workspace, request, 'mcp')),
  )

  server.registerTool(
    'reset_override_config',
    {
      title: 'Reset a simulation override',
      description:
        'Back to the configured settings for the workspace, or for one connection ' +
        '(idempotent). Returns the new override state.',
      inputSchema: ResetOverrideRequest,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    ({ connectionId }) => runTool(() => resetAndPublishOverride(ctx, ctx.workspace, connectionId)),
  )

  server.registerTool(
    'get_override_config',
    {
      title: 'Get the simulation overrides',
      description:
        'The active overrides (workspace and per connection) and the effective simulation ' +
        'settings of every connection.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    () => runTool(() => getOverrideState(ctx.db, ctx.workspace)),
  )
}
