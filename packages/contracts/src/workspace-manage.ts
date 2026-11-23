import { z } from 'zod'
import { ConnectionCredentials, ConnectionView } from './admin'
import { issue } from './common'
import { RateLimitSettings, Retention, SimulationSettings } from './settings'

// Management of an existing workspace and of its connections (#38): the web UI server
// functions and `POST /admin/workspaces/:id/connections/:connectionId/rotate`.

const Name = z.string().trim().min(1).max(80)

const MAX_SLUG_BASE = 56 // + "-" + 6 suffix characters = 63, the Slug maximum

/**
 * Lower-case ASCII, words joined by `-`; `workspace` when nothing is left. The base of
 * generated slugs (core) and the live slug preview of the UI creation dialog.
 */
export function slugify(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAX_SLUG_BASE)
    .replace(/^-+|-+$/g, '')
  return base || 'workspace'
}

/** Editable workspace settings; absent keys are left alone, `null` clears a nullable one. */
export const UpdateWorkspaceRequest = z
  .object({
    name: Name.optional(),
    description: z.string().max(500).nullable().optional(),
    retention: Retention.optional(),
    rateLimit: RateLimitSettings.nullable().optional(), // null = unlimited
    maxMessages: z.number().int().positive().max(10_000_000).nullable().optional(), // null = unbounded
    simulation: SimulationSettings.optional(), // replaces the defaults whole (#43)
  })
  .refine(
    (patch) => Object.values(patch).some((value) => value !== undefined),
    issue('empty_patch', 'Nothing to update'),
  )

/** Rename a connection, or disable it (`enabled: false` sets `disabledAt`). */
export const UpdateConnectionRequest = z
  .object({ name: Name.optional(), enabled: z.boolean().optional() })
  .refine(
    (patch) => patch.name !== undefined || patch.enabled !== undefined,
    issue('empty_patch', 'Nothing to update'),
  )

/** A connection with its secrets: answered once, at creation or rotation. */
export const CreatedConnection = ConnectionView.extend({
  credentials: ConnectionCredentials,
  envSnippet: z.string(),
})

export type UpdateWorkspaceRequest = z.output<typeof UpdateWorkspaceRequest>
export type UpdateConnectionRequest = z.output<typeof UpdateConnectionRequest>
export type CreatedConnection = z.output<typeof CreatedConnection>
