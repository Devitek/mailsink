import { z } from 'zod'
import { IsoDateTime, issue, Page, PageLimit, QueryBool, Slug } from './common'
import { ConnectionId, ConnectionKey, WorkspaceId, WorkspaceKey } from './ids'
import {
  DEFAULT_RETENTION_SECONDS,
  RateLimitSettings,
  Retention,
  SimulationSettings,
  SimulationSettingsPatch,
} from './settings'
import { ConnectionKind } from './status'

const Name = z.string().trim().min(1).max(80)

/** Per-connection overrides of workspace defaults; absent = inherit. */
const ConnectionSettingsInput = {
  name: Name,
  retention: Retention.optional(),
  rateLimit: RateLimitSettings.nullable().optional(), // null = unlimited
  simulation: SimulationSettingsPatch.optional(),
}

export const ConnectionInput = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('resend'), ...ConnectionSettingsInput }),
  z.object({ kind: z.literal('brevo'), ...ConnectionSettingsInput }),
  z.object({
    kind: z.literal('smtp'),
    ...ConnectionSettingsInput,
    smtpUsername: z
      .string()
      .regex(/^[a-zA-Z0-9._-]{3,64}$/)
      .optional(), // generated if absent
  }),
])

export const IDLE_TTL_BOUNDS = { min: 60, max: 30 * 86_400 } as const

/**
 * `idleTtlSeconds` is only accepted for ephemeral workspaces; when absent the server applies
 * its configured default (contracts never read the environment).
 */
export const CreateWorkspaceRequest = z
  .object({
    name: Name,
    slug: Slug.optional(), // generated: name + suffix
    description: z.string().max(500).optional(),
    ephemeral: z.boolean().default(false),
    idleTtlSeconds: z.number().int().min(IDLE_TTL_BOUNDS.min).max(IDLE_TTL_BOUNDS.max).optional(),
    retention: Retention.default(DEFAULT_RETENTION_SECONDS),
    maxMessages: z.number().int().positive().optional(),
    rateLimit: RateLimitSettings.nullable().optional(),
    simulation: SimulationSettings.optional(),
    metadata: z.record(z.string(), z.string().max(256)).optional(),
    connections: z.array(ConnectionInput).max(20).default([]),
  })
  .refine(
    (w) => w.ephemeral || w.idleTtlSeconds === undefined,
    issue('idle_ttl_requires_ephemeral', 'idleTtlSeconds requires ephemeral: true', [
      'idleTtlSeconds',
    ]),
  )

export const ConnectionView = z.object({
  id: ConnectionId,
  name: z.string(),
  kind: ConnectionKind,
  smtpUsername: z.string().nullable(),
  keyPreview: z.string().nullable(), // "msk_live_3f9a…", never the full key
  retentionSeconds: z.number().int().nullable(),
  rateLimit: RateLimitSettings.nullable(),
  simulation: SimulationSettingsPatch.nullable(),
  disabledAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
})

export const WorkspaceView = z.object({
  id: WorkspaceId,
  slug: Slug,
  name: z.string(),
  description: z.string().nullable(),
  ephemeral: z.boolean(),
  idleTtlSeconds: z.number().int().nullable(),
  expiresAt: IsoDateTime.nullable(),
  lastActivityAt: IsoDateTime,
  retentionSeconds: z.number().int(),
  maxMessages: z.number().int().nullable(),
  rateLimit: RateLimitSettings.nullable(),
  simulation: SimulationSettings,
  metadata: z.record(z.string(), z.string()).nullable(),
  urls: z.object({ ui: z.string(), capture: z.string(), mcp: z.string() }),
  createdAt: IsoDateTime,
})

export const WorkspaceDetail = WorkspaceView.extend({ connections: z.array(ConnectionView) })

/** Secrets, returned once at creation. */
export const ConnectionCredentials = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('resend'), apiKey: ConnectionKey, baseUrl: z.string() }),
  z.object({ kind: z.literal('brevo'), apiKey: ConnectionKey, baseUrl: z.string() }),
  z.object({
    kind: z.literal('smtp'),
    smtpHost: z.string(),
    smtpPort: z.number().int().min(1).max(65_535),
    smtpUser: z.string(),
    smtpPass: z.string(),
  }),
])

/** 201, secrets shown once. */
export const CreateWorkspaceResponse = z.object({
  workspace: WorkspaceView,
  workspaceKey: WorkspaceKey, // capture + MCP (D12)
  connections: z.array(
    ConnectionView.extend({
      credentials: ConnectionCredentials,
      envSnippet: z.string(), // RESEND_API_KEY=… RESEND_BASE_URL=…
    }),
  ),
})

export const ListWorkspacesQuery = z.object({
  includeEphemeral: QueryBool.default(false),
  /** Keyset cursor: the `nextCursor` of the previous page, the id of its last workspace. */
  cursor: WorkspaceId.optional(),
  limit: PageLimit,
})

export const ListWorkspacesResponse = Page(WorkspaceView)

export type ConnectionInput = z.output<typeof ConnectionInput>
export type CreateWorkspaceRequest = z.output<typeof CreateWorkspaceRequest>
export type ConnectionView = z.output<typeof ConnectionView>
export type WorkspaceView = z.output<typeof WorkspaceView>
export type WorkspaceDetail = z.output<typeof WorkspaceDetail>
export type ConnectionCredentials = z.output<typeof ConnectionCredentials>
export type CreateWorkspaceResponse = z.output<typeof CreateWorkspaceResponse>
export type ListWorkspacesQuery = z.output<typeof ListWorkspacesQuery>
