# 3. Contracts and critical routes (Zod)

All schemas live in `@mailsink/contracts` (Zod 4) and are imported by the DB layer
(`$type<>` via `z.infer`), server routes, server functions, TanStack Form, router search
params and MCP tool definitions. Provider dialect schemas mirror the public provider
contracts and are tested against the official SDKs (`resend`, `@getbrevo/brevo`,
`nodemailer`) in Phase 3.

## Route map

| Route | Auth | Dialect | Purpose |
|---|---|---|---|
| `POST /admin/workspaces` | Admin key | admin | Create workspace (+ connections) |
| `GET /admin/workspaces?includeEphemeral=` | Admin key | admin | List |
| `GET /admin/workspaces/:id` | Admin key | admin | Detail |
| `PATCH /admin/workspaces/:id` | Admin key | admin | Edit name, description, retention, rate limit (D186), message quota and default simulation (D217) |
| `DELETE /admin/workspaces/:id` | Admin key | admin | Immediate hard delete |
| `POST /admin/workspaces/:id/key/rotate` | Admin key | admin | New `mskw_` workspace key, previous one revoked (D207) |
| `POST /admin/workspaces/:id/connections` | Admin key | admin | Add a connection, secrets once (D186) |
| `PATCH|DELETE /admin/workspaces/:id/connections/:connectionId` | Admin key | admin | Rename, disable / enable; hard delete (D186) |
| `POST /admin/workspaces/:id/connections/:connectionId/rotate` | Admin key | admin | New connection secret, previous one revoked (#38) |
| `POST /v1/emails` · `POST /v1/emails/batch` | `Bearer msk_` (any kind) | native | Native ingestion |
| `POST /emails` · `POST /emails/batch` · `GET /emails/:id` | `Bearer msk_` (resend) | resend | Resend drop-in |
| `POST /v3/smtp/email` | `api-key: msk_` (brevo) | brevo | Brevo drop-in |
| `GET|POST /admin/workspaces/:id/templates` · `GET|PATCH|DELETE …/:templateId` | Admin key | admin | Brevo templates (numeric `templateId`) |
| `GET /admin/logs/api` · `GET /admin/logs/api/:id` | Admin key | admin | API log rows without workspace (D151, D156) |
| SMTP `:1025` | `AUTH PLAIN/LOGIN` (smtp) | smtp | Nodemailer / any client |
| `GET /capture/messages` | workspace scope (D12) | capture | Search, `wait=true` |
| `GET /capture/messages/:id` | workspace scope | capture | Full detail |
| `GET /capture/messages/:id/raw` | workspace scope | capture | `message/rfc822` |
| `GET /capture/messages/:id/attachments/:attId` | workspace scope | capture | Binary |
| `POST /capture/messages/:id/events` | workspace scope | capture | Force opened/clicked or a simulated status |
| `DELETE /capture/messages` | workspace scope | capture | Purge messages and logs |
| `GET /capture/override` · `POST /capture/override` | workspace scope | capture | Read / activate |
| `POST /capture/override/reset` | workspace scope | capture | Back to defaults |
| `GET /capture/suppressions` · `DELETE /capture/suppressions[?email=]` | workspace scope | capture | List / reset |
| `GET /capture/logs/api` · `GET /capture/logs/api/:id` | workspace scope | capture | API request log (#35) |
| `GET /capture/logs/smtp` · `GET /capture/logs/smtp/:id` | workspace scope | capture | SMTP sessions with transcript (#35) |
| `GET|POST /capture/webhooks` · `GET|PATCH|DELETE /capture/webhooks/:id` | workspace scope | capture | Endpoint CRUD |
| `GET /capture/webhooks/deliveries[?endpointId=&payloadFormat=]` · `GET …/:id` | workspace scope | capture | Delivery log |
| `POST /capture/webhooks/deliveries/:id/replay` | workspace scope | capture | Replay (`exact` or `resign`) |
| `POST /capture/webhooks/preview` | workspace scope | capture | Sample payload + headers for a format |
| `POST /capture/webhooks/:id/test` | workspace scope | capture | Send a signed sample event to one endpoint (logged as a delivery) |
| `POST /capture/demo` | workspace scope | capture | Seed the workspace with demo messages through the ingestion pipeline (#62) |
| `GET /capture/stream` | workspace scope | capture | SSE |
| `POST|GET|DELETE /mcp` | workspace scope | mcp | MCP Streamable HTTP |
| `GET /openapi.json` | none (D231) | openapi | OpenAPI 3.1 document of every HTTP surface (« OpenAPI », D230 to D234) |
| `GET /login` · `POST /login` | none (admin key in the body) | not logged | Web UI sign-in page and key exchange for the session cookie (D162, « Web UI auth ») |

Workspace scope = `Authorization: Bearer msk_…|mskw_…`, or Admin key +
`X-Mailsink-Workspace: <id|slug>`. Every authenticated call touches workspace activity.

Activity and ephemeral GC (#20, D16, propositions D85 to D87): the `activity` extension of
`defineApi()` touches the workspace of every call authenticated on one (ingestion,
Capture, SSE, MCP; Admin-only calls touch nothing); SMTP ingestion (#31) calls the same
tracker. One write per workspace per 15 s window: the first touch writes at once, later
ones in the window are written with their own time when it closes. A touch sets
`last_activity_at` and, for an ephemeral workspace, `expires_at = last_activity_at +
idle_ttl_seconds`, never moving them back. Every 30 s the GC writes the pending touches,
deletes the ephemeral workspaces past `expires_at` (everything they own cascades) and
publishes `workspace.deleted` on their channel, which closes their SSE streams. An open
SSE stream is not activity by itself: only its opening request touches.

## Conventions

- The code in `packages/contracts/src/` is the reference; the blocks below are faithful
  excerpts (one file per block, short files, everything re-exported from `index.ts`).
- Contracts never read the environment. Server-side defaults (default idle TTL, base URLs)
  are applied by the server, not by a schema transform.
- Validation messages are English (D19). Every custom refinement also carries a stable
  code in `params.code` (helper `issue(code, message, path?)`, read back with
  `issueCode(zodIssue)`), so the API can return it in `details` and the UI can map it to a
  translated label.
- `.default()` values are output values (Zod 4 does not parse them): a `Duration` default
  is written in seconds (`DEFAULT_RETENTION_SECONDS`), not as `'7d'`.
- Query string schemas accept both raw strings and already parsed values (TanStack Router
  parses search params as JSON): booleans use `QueryBool`, numbers use `z.coerce`.

## Shared primitives (`common.ts`, `address.ts`, `status.ts`, `ids.ts`, `errors.ts`)

```ts
import { z } from 'zod'

export const Email = z.email().transform((e) => e.toLowerCase())
export const Slug = z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/)
/** Positive integer seconds or "90s" | "30m" | "1h" | "7d". Output: seconds. */
export const Duration = z.union([z.number(), z.string()])
  .transform((v, ctx) => /* parseDuration(v); issue `invalid_duration` */)
export const QueryBool = z.union([z.boolean(), z.stringbool()])
export const IsoDateTime = z.iso.datetime({ offset: true })
export const Tag = z.object({ name: z.string().regex(/^[\w-]{1,256}$/),
  value: z.string().max(256) })
export const Page = <T extends z.ZodType>(item: T) =>    // every list endpoint
  z.object({ data: z.array(item), nextCursor: z.string().nullable() })
export const PageLimit = z.coerce.number().int().min(1).max(200).default(50)

// address.ts
/** "jane@x.io" | "Jane <jane@x.io>" | "\"Doe, Jane\" <jane@x.io>" -> { email, name? } | null */
export function parseAddress(input: string): ParsedAddress | null
/** string or { email, name? } -> { email (lower-cased), name? }; issue `invalid_address` */
export const Address = z.union([z.string(), z.object({ email: z.string(),
  name: z.string().optional() })]).transform(/* parseAddress */)
export const AddressList = z.union([Address, z.array(Address)])
  .transform((v) => (Array.isArray(v) ? v : [v]))
/** Output form: keys always present. */
export const AddressOut = z.object({ email: z.string(), name: z.string().nullable() })

// status.ts (mirrors the pg enums of doc 02)
export const DeliveryStatus = z.enum(['queued', 'sent', 'delivered', 'deferred',
  'soft_bounce', 'hard_bounce', 'complained', 'failed', 'invalid', 'suppressed'])
export const SimulatedStatus = DeliveryStatus.exclude(['queued', 'sent', 'suppressed'])
// Canonical webhook events (D22), see « Webhooks » for the per-format mapping.
export const CanonicalEvent = z.enum(['email.sent', 'email.delivered', 'email.deferred',
  'email.soft_bounced', 'email.hard_bounced', 'email.complained', 'email.opened',
  'email.clicked', 'email.suppressed', 'email.failed', 'email.invalid'])
// Also: ConnectionKind, MessageSource, EventType, EventOrigin, RecipientKind.

// ids.ts (D25): prefixed text ids, UUIDv7 body generated by core/ids.ts. Contracts check
// the prefix and a URL-safe body only: /^<prefix>_[A-Za-z0-9-]{1,64}$/.
export const ID_PREFIXES = { workspace: 'ws', connection: 'con', apiKey: 'key',
  override: 'ovr', template: 'tpl', blob: 'blob', message: 'msg', recipient: 'rcp',
  attachment: 'att', event: 'evt', suppression: 'sup', webhookEndpoint: 'whe',
  webhookDelivery: 'whd', apiLog: 'req', smtpSession: 'smtp' } as const
export const WorkspaceId = prefixedId('ws')  // also ConnectionId, MessageId, OverrideId…
export const WorkspaceRef = z.union([WorkspaceId, Slug])   // `:id`, X-Mailsink-Workspace
export const ConnectionKey = z.string().regex(/^msk_[A-Za-z0-9_-]{16,128}$/)
export const WorkspaceKey = z.string().regex(/^mskw_[A-Za-z0-9_-]{16,128}$/)
export function keyKind(token: string): 'connection' | 'workspace' | null
```

## Settings and override (`settings.ts`, `override.ts`)

```ts
export const DEFAULT_RETENTION_SECONDS = 7 * 86_400
/** Proposal: retention bounded to [60 s, 365 d]. */
export const Retention = Duration.pipe(z.number().min(60).max(365 * 86_400))

export const StatusRates = z.partialRecord(SimulatedStatus, z.number().min(0).max(100))
  .refine((r) => Object.values(r).reduce((a, b) => a + (b ?? 0), 0) <= 100,
    issue('rates_sum_exceeds_100', 'Status rates must not add up to more than 100'))
                                                              // remainder -> delivered
export const RecipientRule = z.object({
  match: z.string().min(1),                                   // glob: "*+bounce@*"
  status: SimulatedStatus.optional(),
  delayMs: z.number().int().min(0).max(600_000).optional(),
  smtpCode: z.number().int().min(400).max(599).optional(),
}).refine((r) => r.status !== undefined || r.delayMs !== undefined,
  issue('rule_needs_effect', 'A rule needs a status or a delayMs'))

export const Latency = z.object({
  minMs: z.number().int().min(0).max(600_000),
  maxMs: z.number().int().min(0).max(600_000),
}).refine((l) => l.minMs <= l.maxMs,
  issue('latency_min_gt_max', 'minMs must be lower than or equal to maxMs', ['maxMs']))

export const Chaos = z.object({                               // fails the request itself
  errorRate: z.number().min(0).max(100),
  httpCodes: z.array(z.union([z.literal(429), z.literal(500), z.literal(502),
    z.literal(503)])).min(1).default([500]),
  smtpCodes: z.array(z.union([z.literal(421), z.literal(451), z.literal(452),
    z.literal(550)])).min(1).default([451]),
})

export const RateLimitSettings = z.object({
  limit: z.number().int().positive(),                         // tokens per window
  windowSeconds: z.number().int().positive().default(1),
  burst: z.number().int().positive().optional(),
})

export const SimulationSettings = z.object({   // workspace level, every key resolved
  rates: StatusRates.default({ delivered: 100 }),
  rules: z.array(RecipientRule).max(50).default([]),
  latency: Latency.default({ minMs: 0, maxMs: 0 }),           // queued -> final status
  openRate: z.number().min(0).max(100).default(0),            // auto opened/clicked events
  clickRate: z.number().min(0).max(100).default(0),
})
/** Same keys without defaults (connection level): absent keys inherit. Zod 4 `.partial()`
 *  would still apply the inner defaults, hence a dedicated schema. */
export const SimulationSettingsPatch = z.object({ rates: StatusRates.optional(),
  rules: …optional(), latency: Latency.optional(), openRate: …optional(),
  clickRate: …optional() })

// override.ts
export const OverrideConfig = z.object({
  rates: StatusRates.optional(),
  rules: z.array(RecipientRule).max(50).optional(),
  latency: Latency.optional(),
  chaos: Chaos.optional(),
  rateLimit: RateLimitSettings.optional(),
}).refine((c) => Object.values(c).some((v) => v !== undefined),
  issue('override_empty', 'An override needs at least one setting'))

export const ActivateOverrideRequest = z.object({
  connectionId: ConnectionId.optional(),                      // omitted = workspace-wide
  config: OverrideConfig,
  ttl: Duration.optional(),                                   // auto-reset after (seconds)
})
export const ResetOverrideRequest = z.object({ connectionId: ConnectionId.optional() })
export const OverrideView = z.object({ id: OverrideId, connectionId: ConnectionId.nullable(),
  config: OverrideConfig, activatedVia: EventOrigin, expiresAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime })
export const OverrideState = z.object({
  workspace: OverrideView.nullable(),
  connections: z.array(OverrideView),
  effective: z.record(ConnectionId, SimulationSettings),      // per connection, resolved
})
```

Override behaviour (#22, propositions D73 and D74):
- `GET /capture/override`, `POST /capture/override` and `POST /capture/override/reset` all
  answer 200 with the `OverrideState` after the call. `effective` lists every connection
  of the workspace with its resolved simulation settings.
- Resolution (`simulation/settings-resolver.ts`), field by field: connection override >
  workspace override > connection settings > workspace settings. A field is taken whole
  from the first layer that defines it (`rates` are never merged status by status).
  `openRate` and `clickRate` come from the settings layers only, `chaos` from the overrides
  only (none by default), `rateLimit` from the four layers (`null` = unlimited). The
  resolver also returns the effective `chaos` and `rateLimit` for #24 and #25.
- Activation closes the open override of the same scope (`reset_at`, kept as history, an
  expired one included) and inserts the new one in one transaction, so a scope has at most
  one active override. Two concurrent activations of one scope: the second answers 409
  `conflict`. `activatedVia` is `api` over HTTP. The stored `config` is the parsed contract
  output (`chaos.httpCodes` and `smtpCodes` defaulted, D44).
- `ttl` sets `expiresAt = now + ttl`. An expired override is ignored at read time and
  closed by the override expiry scheduler (every 5 s, `reset_at = expires_at`).
- Reset is idempotent (nothing to close still answers 200). A `connectionId` of another
  workspace answers 404 `not_found`, for activation and reset alike.

Simulation behaviour (#21, propositions D70 to D72):
- The first `simulate_delivery` run decides every `queued` recipient and moves it to
  `sent` at once; its final status is written once its delay is over (rule `delayMs`, else
  a uniform draw in `latency`). A run with decisions still pending enqueues a follow-up job
  at the earliest one.
- Per recipient: the first rule whose glob matches the address wins (case-insensitive,
  whole address, `*` any run of characters `@` included, `?` one character). A rule with a
  `status` fixes it; otherwise the status is drawn from `rates`: `deferred`, `soft_bounce`,
  `hard_bounce`, `complained`, `failed` and `invalid` take their percentage in that order,
  the remainder goes to `delivered`. A rule `smtpCode` lands in the final event
  `data.smtpCode`, its reason (`rule <glob>`) in `data.reason` and `status_reason`.
- Draws are reproducible: each recipient has its own generator seeded from the message
  seed, its address and its attempt. The seed is random per message (injectable with
  `simulateDelivery({ seed })`) and stored in the snapshot.
- `deferred` is applied as an event and a recipient status, then the recipient is
  decided again 1 s plus a new delay later, with the settings of that moment. Past 3
  deferrals, a 4th `deferred` ends as `soft_bounce` (reason `deferred 3 times`).
- `messages.simulation` keeps the decision snapshot: `{ seed, overrideIds: { workspace,
  connection }, sources: { rates: 'workspace_override', … }, recipients: { [email]:
  { status, source: 'rule' | 'rates', rule?, reason?, smtpCode?, delayMs, attempt,
  decidedAt, dueAt, appliedAt? } } }`.
- `hard_bounce` and `complained` add the address to the suppression list (D75).
- The result of a run lists its transitions (`sent`, final or `deferred`, with the event
  id) for the event bus (#26).

## Admin (`admin.ts`)

```ts
const ConnectionSettingsInput = {                    // absent = inherit the workspace
  name: z.string().trim().min(1).max(80),
  retention: Retention.optional(),
  rateLimit: RateLimitSettings.nullable().optional(),       // null = unlimited
  simulation: SimulationSettingsPatch.optional(),
}
export const ConnectionInput = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('resend'), ...ConnectionSettingsInput }),
  z.object({ kind: z.literal('brevo'), ...ConnectionSettingsInput }),
  z.object({ kind: z.literal('smtp'), ...ConnectionSettingsInput,
    smtpUsername: z.string().regex(/^[a-zA-Z0-9._-]{3,64}$/).optional() }), // generated if absent
])

export const CreateWorkspaceRequest = z.object({
  name: z.string().trim().min(1).max(80),
  slug: Slug.optional(),                                      // generated: name + suffix
  description: z.string().max(500).optional(),
  ephemeral: z.boolean().default(false),
  idleTtlSeconds: z.number().int().min(60).max(30 * 86_400).optional(),
  retention: Retention.default(DEFAULT_RETENTION_SECONDS),   // output value: seconds
  maxMessages: z.number().int().positive().optional(),
  rateLimit: RateLimitSettings.nullable().optional(),
  simulation: SimulationSettings.optional(),
  metadata: z.record(z.string(), z.string().max(256)).optional(), // createdBy: D218
  connections: z.array(ConnectionInput).max(20).default([]),
  templates: TemplateSeed.optional(),               // Brevo templates seed (#30)
}).refine((w) => w.ephemeral || w.idleTtlSeconds === undefined,
  issue('idle_ttl_requires_ephemeral', 'idleTtlSeconds requires ephemeral: true',
    ['idleTtlSeconds']))
// The server applies its configured default idle TTL when an ephemeral workspace omits it.

export const ConnectionView = z.object({ id: ConnectionId, name: z.string(),
  kind: ConnectionKind, smtpUsername: z.string().nullable(),
  keyPreview: z.string().nullable(),                // "msk_live_3f9a…", never the full key
  retentionSeconds: z.number().int().nullable(), rateLimit: RateLimitSettings.nullable(),
  simulation: SimulationSettingsPatch.nullable(), disabledAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime })

export const WorkspaceView = z.object({ id: WorkspaceId, slug: Slug, name: z.string(),
  description: z.string().nullable(), ephemeral: z.boolean(),
  idleTtlSeconds: z.number().int().nullable(), expiresAt: IsoDateTime.nullable(),
  lastActivityAt: IsoDateTime, retentionSeconds: z.number().int(),
  maxMessages: z.number().int().nullable(), rateLimit: RateLimitSettings.nullable(),
  simulation: SimulationSettings, metadata: z.record(z.string(), z.string()).nullable(),
  urls: z.object({ ui: z.string(), capture: z.string(), mcp: z.string() }),
  createdAt: IsoDateTime })
export const WorkspaceDetail = WorkspaceView.extend({ connections: z.array(ConnectionView) })
                                                    // GET /admin/workspaces/:id

export const ConnectionCredentials = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('resend'), apiKey: ConnectionKey, baseUrl: z.string() }),
  z.object({ kind: z.literal('brevo'), apiKey: ConnectionKey, baseUrl: z.string() }),
  z.object({ kind: z.literal('smtp'), smtpHost: z.string(),
    smtpPort: z.number().int().min(1).max(65_535), smtpUser: z.string(), smtpPass: z.string() }),
])

export const CreateWorkspaceResponse = z.object({   // 201, secrets shown once
  workspace: WorkspaceView,
  workspaceKey: WorkspaceKey,                       // capture + MCP (D12)
  connections: z.array(ConnectionView.extend({ credentials: ConnectionCredentials,
    envSnippet: z.string() })),                     // RESEND_API_KEY=… RESEND_BASE_URL=…
})

export const ListWorkspacesQuery = z.object({
  includeEphemeral: QueryBool.default(false),
  cursor: WorkspaceId.optional(),                   // nextCursor: id of the last row
  limit: PageLimit,
})
export const ListWorkspacesResponse = Page(WorkspaceView)
```

The `.env` snippet itself is built by the Admin API (server side, it knows the public base
URLs); the contract only carries the string.

Admin API behaviour (#13, #19; services in `core/workspaces/` and `core/connections/`):

- Auth: the Admin key only (D41); with `MAILSINK_ADMIN_KEY` unset every call gets 401.
- `POST` answers 201 with `CreateWorkspaceResponse`, the only place secrets ever appear.
  Workspace, connections and keys are written in one transaction. A taken slug or SMTP
  username (also twice in the same request) answers 409 `conflict`; nothing is written.
- Generated values (D50): slug `<slugified name>-<6 [a-z0-9]>`; keys
  `msk_` / `mskw_` + 32 random bytes base64url, stored as SHA-256 with a `display_prefix`
  of the prefix plus 8 characters (`keyPreview` = display prefix + `…`); SMTP username
  `<slug>-<8 hex>`, password 24 random bytes base64url, stored as
  `scrypt$16384$8$1$<salt>$<key>` (D11). Only `resend` and `brevo` connections get an
  `msk_` key; `smtp` connections get SMTP credentials and `keyPreview: null`.
- Credentials and snippets (D52): Resend `baseUrl` = `MAILSINK_PUBLIC_URL`
  (`RESEND_API_KEY`, `RESEND_BASE_URL`, read by the Resend SDK); Brevo `baseUrl` =
  `MAILSINK_PUBLIC_URL/v3` (`BREVO_API_KEY`, `BREVO_BASE_URL`); SMTP host =
  `MAILSINK_SMTP_PUBLIC_HOST`, else the hostname of `MAILSINK_PUBLIC_URL`; port =
  `MAILSINK_SMTP_PUBLIC_PORT`, else the port the SMTP listener is bound to (D66;
  `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`).
- `urls` (D35): `ui` = `<public>/w/<slug>`, `capture` = `<public>/capture`, `mcp` =
  `<public>/mcp`.
- Ephemeral (#19): `idleTtlSeconds` defaults to `MAILSINK_DEFAULT_IDLE_TTL` (bare seconds
  or a duration, 60 s .. 30 d, default 3600); `last_activity_at` = creation time and
  `expires_at` = creation + TTL. Persistent workspaces keep both TTL columns null; an
  `idleTtlSeconds` there is refused (D34, 422 `idle_ttl_requires_ephemeral`).
- `GET /admin/workspaces`: newest first; `nextCursor` is the id of the last workspace of
  the page (keyset on the UUIDv7 id); the contract types `cursor` as a `WorkspaceId`, so a
  malformed cursor is a 422.
- `GET` and `DELETE /admin/workspaces/:id` take an id or a slug; `DELETE` answers 204 and
  cascades to every workspace-owned row; an unknown workspace is a 404.
- `POST /admin/workspaces/:id/connections/:connectionId/rotate` (#38, D172): `resend` and
  `brevo` get a new `msk_` key and every previous key of the connection is revoked in the
  same transaction (no grace period); `smtp` gets a new password, same username. Answers
  200 `CreatedConnection`, the secret shown once; a connection of another workspace is a
  404.
- Parity with the web UI (owner decision D186, #105, #106), on the same core services:
  `PATCH /admin/workspaces/:id` (`UpdateWorkspaceRequest`, 200 `WorkspaceView`, an empty
  patch is a 422 `empty_patch`; `maxMessages` and `simulation` too, proposition D217); `POST /admin/workspaces/:id/connections` (`ConnectionInput`,
  201 `CreatedConnection`, a taken SMTP username is a 409); `PATCH
  /admin/workspaces/:id/connections/:connectionId` (`UpdateConnectionRequest`, 200
  `ConnectionView`); `DELETE` of the same path (204, hard delete, D173). Workspaces by id or
  slug, a connection of another workspace is a 404.
- `metadata.createdBy` (proposition D218): free text naming who created the workspace
  (« github-actions · run #8841 »); the TTL banner of an ephemeral workspace in the web UI
  shows it. Nothing else reads it.
- `POST /admin/workspaces/:id/key/rotate` (D207): a new `mskw_` key, every active workspace
  key of the workspace revoked in the same transaction (no grace period); 200
  `RotatedWorkspaceKey { workspaceKey, keyPreview }`, the key shown once. The web UI does
  the same from the connections page (session-checked server function).

### Workspace and connection management (`workspace-manage.ts`, #38, D170 to D174)

```ts
export const UpdateWorkspaceRequest = z.object({ name: Name.optional(),
  description: z.string().max(500).nullable().optional(), retention: Retention.optional(),
  rateLimit: RateLimitSettings.nullable().optional(),
  maxMessages: z.number().int().positive().nullable().optional(), // null = unbounded (#43)
  simulation: SimulationSettings.optional() })                   // at least one key; replaced whole
export const UpdateConnectionRequest = z.object({ name: Name.optional(),
  enabled: z.boolean().optional() })                             // at least one key
export const CreatedConnection = ConnectionView.extend({ credentials: ConnectionCredentials,
  envSnippet: z.string() })                                      // creation or rotation
export const RotatedWorkspaceKey = z.object({ workspaceKey: WorkspaceKey,
  keyPreview: z.string() })                                      // "mskw_3f9a…", D207
```

Core services (`core/connections/manage.ts`, `core/workspaces/update.ts`), called by the
web UI server functions (`apps/mailsink/src/server-fns/{connections,workspaces-manage}-fns.ts`,
session-checked, never the admin key from the browser) and by the rotation route:
`addConnection`, `updateConnectionSettings` (rename; `enabled: false` sets `disabled_at`,
`true` clears it), `rotateConnectionCredentials`, `removeConnection` (hard delete; keys,
webhook endpoints and overrides cascade, messages and logs keep a null connection) and
`updateWorkspaceSettings` (the slug never changes). The UI names workspaces by slug only
and touches their activity on every call (D163); a taken slug or SMTP username comes back
as a field conflict, not a failure.

The settings page (#43, D200 to D204) reuses the same pattern
(`server-fns/{settings,webhooks,templates}-fns.ts`): `updateWorkspaceSettings` for the
defaults (message quota, default simulation, rate limit), the `/capture/webhooks` services
for endpoints (create, patch, delete, preview, test send) plus a session-only read of the
stored signing secret, and the Admin template services with a `renderTemplate` preview.

## Native ingestion (`native.ts`)

```ts
export const AttachmentInput = z.object({
  filename: z.string().min(1).max(255),
  content: z.base64(),
  contentType: z.string().optional(),               // sniffed from filename otherwise
  contentId: z.string().optional(),                 // inline cid
})

export const SendEmailRequest = z.object({
  from: Address, to: AddressList, cc: AddressList.optional(), bcc: AddressList.optional(),
  replyTo: AddressList.optional(),                  // camelCase like the rest of the native API
  subject: z.string().max(998),
  html: z.string().optional(), text: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  tags: z.array(Tag).max(50).optional(),
  attachments: z.array(AttachmentInput).max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).refine((e) => e.to.length > 0, issue('to_required', …, ['to']))
  .refine((e) => Boolean(e.html || e.text), issue('html_or_text_required', …, ['html']))
  .refine((e) => e.to.length + (e.cc?.length ?? 0) + (e.bcc?.length ?? 0) <= 50,
    issue('too_many_recipients', …, ['to']))

export const SendEmailResponse = z.object({ id: MessageId, status: DeliveryStatus })
/** Envelope only: items are validated one by one with parseBatchItem (SendEmailRequest),
 *  so an invalid item fails its own slot, not the whole batch. */
export const BatchRequest = z.array(z.unknown()).min(1).max(100)
export function parseBatchItem(item: unknown):
  { ok: true; data: SendEmailRequest } | { ok: false; error: ApiError }
export const BatchResponse = z.object({              // 207 when partial, 200 when all ok
  data: z.array(z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), index: z.number().int(), id: MessageId }),
    z.object({ ok: z.literal(false), index: z.number().int(), error: ApiError }),
  ])),
})
// Header: Idempotency-Key (<= 256 chars, 24 h). Same key + different body -> 409.
```

Every dialect maps to one internal type, `NormalizedEmail` (`core/ingestion/normalize.ts`),
the only input of the ingestion pipeline.

Pipeline (`core/ingestion/`), shared by every dialect:

1. `prepareEmail` (outside any transaction): composes the raw EML with Nodemailer
   `MailComposer` when the dialect brought none (D9; `Message-ID: <msg_…@mailsink>`, Bcc left
   out of the headers, file and URL access disabled), enforces `MAILSINK_MAX_MESSAGE_BYTES`
   on it, and extracts the http(s) links (html anchors with their text, then bare urls of
   the text part, deduplicated, at most 500).
2. `persistEmails` (one transaction): raw EML and attachments go to the `BlobStore`
   (database driver, deduplicated by sha256 per workspace, D8); the message, one recipient
   row per address (D10, an address listed twice keeps its first kind, to > cc > bcc), its
   attachments and an `accepted` event (origin `simulation`) are inserted. A recipient on
   the workspace suppression list is stored `suppressed` with a `suppressed` event. The
   message is `queued` and one `simulate_delivery` job `{ messageId }` is enqueued in the
   same transaction, unless every recipient is suppressed (message `suppressed`, no job).

HTTP behaviour of `POST /v1/emails` and `POST /v1/emails/batch`:

- Any `msk_` connection key; the message records the connection and `source: 'native'`.
- The request body is capped at `MAILSINK_MAX_MESSAGE_BYTES` (default 25 MB) before any
  parsing (`defineApi` option `maxBodyBytes`): `413 payload_too_large`. A batch is capped as
  a whole; each composed message is capped again (a batch item over the cap fails its slot).
- Batch: the envelope is validated as a whole (`422` when it is not an array of 1 to 100),
  then each item alone; the valid items are stored in one transaction. `200` when every item
  is accepted, `207` otherwise (also when none is).
- `Idempotency-Key` (at most 256 characters, else `400 validation_error`): scoped to the
  workspace, kept 24 h, stored in the same transaction as the messages. The same key with
  the same route and body (key order ignored) replays the stored status and body with the
  header `Idempotent-Replayed: true`; with another body it fails with
  `409 idempotency_mismatch`. Two concurrent requests on a new key store one message.

## Resend dialect (`resend.ts`)

Checked on 23/11 against the Resend API reference and the `resend` Node SDK 6.39 (the
contract tests run that SDK against Mailsink). Schemas, excerpts:

```ts
export const ResendAddress = z.string()             // "jane@x.io" | "Jane <jane@x.io>", no objects
export const ResendAddressList = z.union([ResendAddress, z.array(ResendAddress)]) // -> array
export const ResendTag = z.object({ name: TAG_PART, value: TAG_PART })  // [A-Za-z0-9_-]{1,256}
export const ResendAttachment = z.object({
  content: z.base64().optional(),                   // the SDK sends a Buffer as base64
  path: z.string().optional(),                      // refused: Mailsink fetches nothing (D123)
  filename: z.string().optional(), content_type: z.string().optional(),
  content_id: z.string().optional(),                // inline cid
})
export const ResendSendRequest = z.object({
  from: ResendAddress, to: ResendAddressList, subject: z.string(),
  cc: ResendAddressList.optional(), bcc: ResendAddressList.optional(),
  reply_to: ResendAddressList.optional(), replyTo: ResendAddressList.optional(), // pre-1.0 SDKs
  html: z.string().optional(), text: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  attachments: z.array(ResendAttachment).optional(),
  tags: z.array(ResendTag).optional(),
  scheduled_at: z.string().optional(),              // accepted, not honoured (D123)
  topic_id: z.string().nullable().optional(),       // accepted, ignored
  template: z.unknown().optional(),                 // refused: hosted templates (D123)
}) // + refinements: to 1..50, html or text present
export const ResendBatchValidation = z.enum(['strict', 'permissive'])  // x-batch-validation
export const ResendSendResponse = z.object({ id: z.uuid() })            // 200
export const ResendBatchResponse = z.object({ data: z.array(z.object({ id: z.uuid() })),
  errors: z.array(z.object({ index: z.number().int(), message: z.string() })).optional() })
export const ResendEmail = z.object({               // GET /emails/:id
  object: z.literal('email'), id: z.uuid(), message_id: z.string(),
  to: z.array(z.string()), from: z.string(), created_at: z.string(), subject: z.string(),
  html: z.string().nullable(), text: z.string().nullable(),
  bcc: z.array(z.string()), cc: z.array(z.string()), reply_to: z.array(z.string()),
  last_event: ResendLastEvent, scheduled_at: z.string().nullable(),
  tags: z.array(z.object({ name: z.string(), value: z.string() })) })
export const ResendErrorBody = z.object({           // every error
  statusCode: z.number().int(), name: ResendErrorName, message: z.string() })
```

Behaviour (`core/dialects/resend*.ts`, `http/dialects/resend/`):

- Auth: `Authorization: Bearer msk_…` of a `resend` connection only. A key of another
  connection kind, a workspace key or the Admin key: `403 restricted_api_key`, checked
  before the rate limit spends a token. A missing key: `401 missing_api_key`
  `Missing API Key`. An unknown or revoked key: `401 validation_error` `API key is invalid`
  on `POST /emails` and `/emails/batch`, `400` with the same body on `GET /emails/:id`, as
  Resend answers every endpoint but sending (D158; the dialect reads `details.credential`
  of the shared auth and sets the status through `ErrorFormatter.status`).
- Ids (D120): the Resend id of a message is the UUIDv7 of its `msg_` id
  (`msg_<uuid>`, also stored as `provider_message_id`), so `GET /emails/:id` reads the
  message by primary key. `message_id` is the `Message-ID` an SMTP client wrote itself,
  else the composed one (`<msg_…@mailsink>`, D158).
- `POST /emails`: validated by the dialect (`parseResendEmail`, not by `defineApi`, which
  only caps and reads the JSON), mapped by `fromResendRequest` to `NormalizedEmail`
  (`source: 'resend'`, `metadata: null`), then the shared pipeline. `200 { id }`.
- `POST /emails/batch` (D121): 1 to 100 emails, no `attachments` (Resend: « not supported
  yet »). Header `x-batch-validation` (the SDK always sends it): `strict` (default) stores
  everything or nothing and answers the first refused email, its message prefixed with
  `emails[i]: `; `permissive` stores the valid emails and answers
  `200 { data, errors: [{ index, message }] }`, `data` holding the stored ones in order.
  Any other value: `400 validation_error`.
- `GET /emails/:id`: any message of the workspace (whatever its source or connection).
  A malformed id: `422 invalid_parameter` `` The `id` must be a valid UUID. ``; unknown:
  `404 not_found` `Email not found`. `created_at` as Resend (`2026-04-03 22:13:42.674+00`),
  `last_event` from the latest message event: `accepted` `queued`, `deferred` and
  `soft_bounce` `delivery_delayed` (D22), `hard_bounce` `bounced`, the others by name.
  `scheduled_at` is always `null`.
- `Idempotency-Key` (the SDK option `idempotencyKey`): the native rules (24 h, scoped to the
  workspace, stored with the messages), scopes `POST /emails` and
  `POST /emails/batch <mode>`. Over 256 characters: `400 invalid_idempotency_key`; another
  body: `409 invalid_idempotent_request`; a replay keeps `Idempotent-Replayed: true`.
- Validation errors are worded as Resend: a missing `from`, `to` or `subject`, or neither
  `html` nor `text`: `422 missing_required_field` (`` Missing `to` field. ``); an invalid
  field: `400 validation_error` (`` Invalid `from` field. The email address needs to
  follow … ``); an attachment without `content`: `422 invalid_attachment`. A message over
  `MAILSINK_MAX_MESSAGE_BYTES`: `413 validation_error`.
- Rate limit and chaos (D122): `INGESTION_EXTENSIONS` on the three routes (Resend's limit
  counts every request), plus `ratelimit-limit`, `ratelimit-remaining`, `ratelimit-reset`
  copied from the `X-RateLimit-*` headers (`Retry-After` is shared).
- Error names (`http/dialects/resend/errors.ts`, D122): `details.resend` set by the dialect
  wins; otherwise `unauthorized` `missing_api_key` (no credential) or `validation_error`,
  `forbidden` `restricted_api_key`,
  `not_found` `not_found`, `idempotency_mismatch` `invalid_idempotent_request`,
  `rate_limited` `rate_limit_exceeded`, `chaos_injected` by drawn status (`429`
  `rate_limit_exceeded`, `503` `service_unavailable`, else `application_error`),
  `internal_error` `application_error` (`An unexpected error occurred.`), the rest
  `validation_error`. The body never carries `details`.
- Not emulated (D123): hosted templates (`template`, `400 validation_error`), attachment
  `path` URLs (`422 invalid_attachment`), the delay of `scheduled_at`, the plain text
  Resend generates from `html` when `text` is absent, `topic_id`.

Resend batch is all-or-nothing by default (provider parity); the native batch is partial.

## Brevo dialect (`brevo.ts`)

`POST /v3/smtp/email` mirrors `SendTransacEmailRequest` of the official SDK
(`@getbrevo/brevo` 6.x, which posts to `<baseUrl>/smtp/email` with the `api-key` header;
`BREVO_BASE_URL` = `MAILSINK_PUBLIC_URL/v3`). Checked against developers.brevo.com on
23/11/2026: `subject` is required without `templateId`, versions may override `htmlContent`,
`textContent` and `replyTo`, a version holds at most 99 recipients and a request 2000,
`batchId` exists, `name` is only required with base64 `content`.

```ts
export const BrevoAddress = z.object({ email: Email, name: z.string().max(70).optional() })
const Recipients = z.array(BrevoAddress).max(99)
export const BrevoMessageVersion = z.object({ to: Recipients.min(1),
  cc: Recipients.optional(), bcc: Recipients.optional(), replyTo: BrevoAddress.optional(),
  subject: z.string().max(998).optional(), htmlContent: z.string().optional(),
  textContent: z.string().optional(), params: z.record(z.string(), z.unknown()).optional() })
export const BrevoSendRequest = z.object({
  sender: BrevoAddress.optional(),                  // `sender.id` is not supported
  to: Recipients.optional(), cc: Recipients.optional(), bcc: Recipients.optional(),
  replyTo: BrevoAddress.optional(), subject: z.string().max(998).optional(),
  htmlContent: z.string().optional(), textContent: z.string().optional(),
  templateId: TemplateExternalId.optional(),        // positive 32-bit integer
  params: z.record(z.string(), z.unknown()).optional(),        // {{ params.x }} injection
  headers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  attachment: z.array(z.object({ content: z.base64().optional(), url: z.url().optional(),
    name: z.string().min(1).max(255).optional() })).max(100).optional(), // content or url
  tags: z.array(z.string().min(1).max(256)).max(50).optional(),
  scheduledAt: IsoDateTime.optional(),              // stored in metadata, not delayed
  batchId: z.uuid().optional(),                     // stored in metadata
  messageVersions: z.array(BrevoMessageVersion).min(1).max(1000).optional(),
}) // refinements (stable codes): to_required (without messageVersions), content_required,
   // sender_required, subject_required (each unless templateId), too_many_recipients (2000)
export const BrevoSendResponse = z.union([
  z.object({ messageId: z.string() }),              // "<msg_…@mailsink>" = Message-ID header
  z.object({ messageIds: z.array(z.string()) }),    // with messageVersions, in version order
])                                                  // 201
export const BrevoError = z.object({ code: BrevoErrorCode, message: z.string() })
```

Behaviour (#29, D125 to D127):

- Auth: `api-key: msk_…` (or a bearer) of a **brevo** connection; another connection kind,
  a workspace key or the Admin key answer 403. The message records the connection and
  `source: 'brevo'`. Rate limit and chaos run first (`INGESTION_EXTENSIONS`, D92); the body
  is read under `MAILSINK_MAX_MESSAGE_BYTES`.
- One message per message version (one message without `messageVersions`), all stored in
  one transaction through the shared pipeline. A version takes `to`, and overrides `cc`,
  `bcc`, `replyTo`, `subject`, `htmlContent`, `textContent`; its `params` are merged over the
  global ones. The global `to` is ignored with `messageVersions`, as Brevo does.
- `templateId`: the workspace template with that `externalId` (below). Its html and text
  replace the request bodies; its subject and sender apply unless the request sets them.
  An unknown id answers `400 invalid_parameter` (`Template ID N does not exist`). The
  message keeps `templateRef { templateId, params }`.
- Rendering (`core/templates/render.ts`, D126): subject, html and text, with or without a
  template, go through a safe renderer. `{{ params.a.b }}` reads `params` (own properties of
  plain objects, numeric indexes of arrays, nothing inherited); `{{ contact.EMAIL }}` is the
  first `to` address of the message, other contact attributes render empty (Mailsink keeps
  no contacts). Unknown variables render empty. Filters: `default: "x"`, `upper`, `lower`,
  `safe`. Values are HTML-escaped in the html body unless `safe`; objects print as JSON.
  Other tags (`{{ unsubscribe }}`, `{% if %}` blocks, expressions) are left verbatim.
- Mapping: each tag string becomes the tag `{ name: 'tag', value }`; base64 attachments are
  stored, `url` attachments are never fetched and are listed in
  `metadata.brevo.attachmentUrls` with `scheduledAt` and `batchId`; header values are
  stringified and kept.
- Idempotency, as Brevo documents it (« Idempotency for batch emails », checked on
  24/11/2026, D279), not the native semantics of D53: the key is the `idempotencyKey`
  entry of the `headers` body field (any case: the guide writes `idempotencyKey`, the send
  reference `IdempotencyKey`), a UUID (else `400 invalid_parameter`,
  `headers.idempotencyKey: idempotencyKey must be a UUID`). It lives 30 minutes, per
  connection (a Brevo account); any reuse within that window, same body or not, answers
  `400 duplicate_parameter` (`Request already processed: idempotencyKey <key> was used in
  the last 30 minutes`) and stores nothing. A key covers the whole request
  (`messageVersions` included); a request refused before being stored (invalid body,
  unknown template) does not consume its key. The `Idempotency-Key` HTTP header is
  ignored, as Brevo ignores it.
- `X-Mailin-custom` in `headers` is kept with the message headers and returned in every
  Brevo format webhook of the message (`X-Mailin-custom` payload field, #149).
- Rate limit headers: `X-RateLimit-*` (D91) plus Brevo's `x-sib-ratelimit-limit`,
  `x-sib-ratelimit-remaining`, `x-sib-ratelimit-reset` with the same values.

Errors (`http/dialects/brevo/errors.ts`, D127): body `{ code, message }`, no `requestId`
(the `X-Request-Id` header stays). Every invalid body answers **400** (never 422); the
message names the first failing field (`sender: sender is required when templateId is
absent`).

| Mailsink code | Status | Brevo `code` |
|---|---|---|
| `validation_error` | 400 | `missing_parameter` (absent field, `*_required`), `out_of_range` (bounds, `too_many_recipients`), else `invalid_parameter` (unreadable JSON included) |
| `unauthorized` | 401 | `unauthorized` |
| `forbidden` | 403 | `permission_denied` |
| `not_found` | 404 | `document_not_found` |
| `conflict` | 409 | `duplicate_parameter` |
| `idempotency_mismatch` | 400 | `duplicate_parameter` (D279) |
| `payload_too_large` | 413 | `out_of_range` |
| `rate_limited` | 429 | `too_many_requests` (Brevo documents the status, not the code) |
| `chaos_injected` | drawn | `chaos_injected` (D93) |
| `internal_error`, `wait_timeout` | 500, 408 | `internal_error` |

The official SDK only types `400` (`Brevo.BadRequestError`, and `404 Brevo.NotFoundError` on
`DELETE /v3/smtp/blockedContacts/{email}`); every other status reaches the caller as a
`BrevoError` with `statusCode` and this `body`. Contract tests:
`apps/mailsink/src/http/dialects/brevo/sdk.contract.test.ts` and
`sdk-read.contract.test.ts` (read routes).

### Brevo read routes (`brevo-read.ts`, #149, D275, D276)

Checked against developers.brevo.com and `@getbrevo/brevo` 6.2 on 24/11/2026
(`getTransacEmailsList`, `getTransacBlockedContacts`,
`unblockOrResubscribeATransactionalContact`). Same auth, kind check (403
`permission_denied`), rate limit, chaos and `x-sib-ratelimit-*` headers as the send route;
every invalid query or path answers 400 with the Brevo codes above. Days are `YYYY-MM-DD`
calendar days of the workspace `timezone` (D23, D284; `core/dialects/brevo/days.ts`), the
timezone Brevo dates its webhooks in; « in the future » means after today in that zone.

```ts
export const BrevoListEmailsQuery = z.object({ email: Email.optional(),
  templateId: TemplateExternalId.optional(), messageId: z.string().optional(),
  startDate: BrevoDay.optional(), endDate: BrevoDay.optional(),
  sort: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(0).max(500).default(500),
  offset: z.coerce.number().int().min(0).default(0) })
  // filter_required (one of email, templateId, messageId: missing_parameter),
  // date_range_required (both dates or none: missing_parameter), date_range_order,
  // date_range_too_long (end after start plus one calendar month: out_of_range)
export const BrevoListEmailsResponse = z.object({ count: z.number().int(),
  transactionalEmails: z.array(z.object({ email: z.string(), subject: z.string(),
    templateId: z.number().int().optional(), messageId: z.string(), uuid: z.string(),
    date: z.string(), from: z.string().optional(), tags: z.array(z.string()).optional() })) })
export const BrevoBlockedContactsQuery = z.object({ startDate, endDate, // both or none,
  // never in the future (date_in_future: today of the workspace timezone, checked in core)
  limit: z.coerce.number().int().min(0).max(100).default(50), offset, sort,
  senders: z.string() | z.array(z.string()) })   // comma separated and/or repeated
export const BrevoBlockedContactsResponse = z.object({ count: z.number().int(),
  contacts: z.array(z.object({ email: z.string(), senderEmail: z.string().nullable(),
    reason: z.object({ code: BrevoBlockReasonCode, message: z.string() }),
    blockedAt: z.string() })) })
```

- `GET /v3/smtp/emails` (D275): one item per message and recipient (`to`, `cc`, `bcc`)
  sent through the **calling connection** only, a Brevo account being one connection.
  `email` is the recipient, `messageId` the id `POST /v3/smtp/email` answered (angle
  brackets optional in the filter), `uuid` the recipient row id (UUIDv7, without `rcp_`),
  `date` the creation time (`2026-11-24T10:00:00Z`), `from` the sender address, `tags`
  the tag values (omitted when empty, as `templateId` without a template). Without dates
  the window is the past 30 days, as Brevo; `count` counts every item of the filters.
- `GET /v3/smtp/blockedContacts` (D276): the workspace suppression list (D75), newest first
  unless `sort=asc`, by offset. `senderEmail` is the sender of the message that listed the
  address (null for a manual entry or a purged message); `senders` keeps the rows listed by
  one of them. Reasons: `hard_bounce` -> `hardBounce` « Hard bounce », `complained` ->
  `contactFlaggedAsSpam` « Contact flagged as spam », `manual` -> `adminBlocked` « Admin
  blocked »; the unsubscription codes are never produced.
- `DELETE /v3/smtp/blockedContacts/{email}` (D276): removes the address (URL-encoded, case
  insensitive) from the workspace list, `204`; an address not listed is
  `404 document_not_found`, an invalid one `400 invalid_parameter`.

## Brevo templates (`templates.ts`, Admin API)

```ts
export const TemplateExternalId = z.coerce.number().int().positive().max(2_147_483_647)
export const TemplateInput = z.object({
  externalId: TemplateExternalId.optional(),        // next free id of the workspace if absent
  name: z.string().trim().min(1).max(200), subject: z.string().max(998),
  html: z.string().max(1_000_000).nullable().optional(),
  text: z.string().max(1_000_000).nullable().optional(),
  sender: Address.nullable().optional(),            // default sender of the template
}).refine((t) => Boolean(t.html || t.text), issue('html_or_text_required', …, ['html']))
export const TemplatePatch = /* same fields but externalId, all optional; at least one
                                 (empty_patch) */
export const TemplateView = z.object({ id: TemplateId, externalId: z.number().int(),
  name: z.string(), subject: z.string(), html: z.string().nullable(),
  text: z.string().nullable(), sender: AddressOut.nullable(),
  createdAt: IsoDateTime, updatedAt: IsoDateTime })
export const ListTemplatesQuery = z.object({ cursor: TemplateExternalId.optional(),
  limit: PageLimit })
export const ListTemplatesResponse = Page(TemplateView)
export const TemplateSeed = z.array(TemplateInput).max(500)  // CreateWorkspaceRequest.templates
```

Routes (#30, Admin key only, `:id` an id or a slug, `:templateId` the numeric `externalId`,
D128):

- `GET /admin/workspaces/:id/templates?cursor=&limit=`: ascending `externalId`,
  `nextCursor` = the `externalId` of the last row.
- `POST /admin/workspaces/:id/templates`: 201 `TemplateView`; without `externalId` the
  next id after the highest of the workspace; a taken id answers 409 `conflict`.
- `GET`, `PATCH`, `DELETE /admin/workspaces/:id/templates/:templateId`: 200, 200 (absent
  fields kept, a template left without html nor text is a 422 `html_or_text_required`),
  204. An unknown workspace or template is a 404; a non numeric `:templateId` a 422.
- Seed at provisioning (D129): `POST /admin/workspaces` accepts `templates` (at most 500),
  typically the content of a JSON file kept next to the test suite. They are inserted in the
  workspace transaction (explicit ids first, the others numbered after them in order); two
  entries with the same `externalId` answer 409 and nothing is created.
- The web UI screen comes with Phase 4.

## SMTP mapping (`dialects/smtp.ts`)

Server: `packages/smtp` (smtp-server), listening on `MAILSINK_SMTP_HOST:MAILSINK_SMTP_PORT`
(1025). Replies carry their enhanced status code in the text; smtp-server's own replies
(`530`, `503`...) carry none. Propositions D130 to D134.

| Step | Behaviour |
|---|---|
| `EHLO` | Advertises `AUTH PLAIN LOGIN`, `SIZE <MAILSINK_MAX_MESSAGE_BYTES>`, and `STARTTLS` only when `MAILSINK_SMTP_TLS_CERT` and `MAILSINK_SMTP_TLS_KEY` (PEM file paths, both or neither, read at boot) are set |
| `AUTH PLAIN/LOGIN` | `smtp_username` -> `smtp` connection; scrypt verify, skipped when the verified-credential cache (D11) already holds this password for this stored hash; unknown user, wrong password or disabled connection -> `535 5.7.8 Authentication credentials invalid`. Allowed without TLS. Success touches workspace activity |
| No AUTH | `MAIL FROM` -> `530` |
| `MAIL FROM` | Effective settings of the connection, then rate limit (one token per transaction), then chaos (D92); touches activity. Nothing read nor stored when refused. A `SIZE=` over the cap -> `552 Error: message exceeds fixed maximum message size N`, written by smtp-server before `onMailFrom`, without enhanced code (D159) |
| `RCPT TO` | Every address accepted; a suppressed one is accepted, then marked `suppressed` by the pipeline (provider parity) |
| Rate limit | `451 4.7.1 Rate limit exceeded, retry in Ns` |
| Chaos | `421`/`451`/`452`/`550` per active override (`smtpGuardReply`, D94); `421` closes the connection |
| `DATA` | size cap -> `552 5.3.4 Message exceeds the N bytes limit` (size not declared at `MAIL FROM`, D159); `mailparser` -> `NormalizedEmail` + raw EML kept byte for byte (D9); then the shared pipeline, `source: 'smtp'`, `message.created` published once committed |
| Reply | `250 2.0.0 Ok: queued as msg_…` (the message id, also its `providerMessageId`) |
| Failure | Unexpected error -> `451 4.3.0 Local error in processing` (logged); a message without any sender -> `550 5.6.0` |

`DATA` to `NormalizedEmail` (`fromSmtpMessage(raw, envelope)`):

- Recipients come from the envelope: an `RCPT TO` address listed in `To` or `Cc` keeps that
  kind and its display name, any other one is `bcc`; a header address absent from `RCPT TO`
  is not a recipient. Addresses are lower-cased.
- `from` = the `From` header, else `MAIL FROM`; `subject` = `Subject` or `''`; `html` /
  `text` as sent (no conversion between them), `cid:` links kept.
- `headers` = every header except `From`, `To`, `Cc`, `Bcc`, `Reply-To`, `Subject`,
  `MIME-Version`, `Content-Type`, `Content-Transfer-Encoding`; names lower-cased, folded
  values unfolded, repeated names joined with `, `.
- Attachments with their filename, content type and, when inline (`related` or
  `Content-Disposition: inline`), their content id. `tags: []`, `metadata: null`.

Session transcript (`RecordSmtpSession`, written to `smtp_sessions` by #35; a no-op
until then): one `SmtpSessionRecord` per connection, handed over after it closed, shaped
like the `smtp_sessions` row (`id` `smtp_…`, workspace and connection once authenticated,
`remoteAddress`, `clientHostname` = the `EHLO` name, `authUser`, `secure`, `messageIds`,
`outcome`, `error` = the last `4xx`/`5xx` reply, `startedAt`, `endedAt`). Transcript lines
`{ at (epoch ms), dir: 'C' | 'S', line }`: AUTH arguments and continuation lines read
`/* secured */`, `DATA` content is one `<N bytes of DATA>` line, at most 500 lines of 1 000
characters (then one `[mailsink] N more lines not recorded` line). Outcome: `accepted`
when a message was stored, else `error` after a server-side failure, else `auth_failed`
when AUTH failed and never succeeded, else `rejected`.

## Capture (`capture.ts`)

```ts
export const ListMessagesQuery = z.object({
  to: z.string().optional(), from: z.string().optional(),     // substring, case-insensitive
  subject: z.string().optional(), tag: z.string().optional(),  // "name" or "name:value"
  // "delivered", "delivered,failed" or a repeated ?status= -> always an array
  status: z.preprocess((v) => (typeof v === 'string' ? v.split(',') : v),
    z.array(DeliveryStatus)).optional(),
  connectionId: ConnectionId.optional(),
  since: IsoDateTime.optional(), until: IsoDateTime.optional(),
  q: z.string().optional(),                                    // full text (subject, body)
  limit: PageLimit,
  cursor: z.string().optional(),
  wait: QueryBool.default(false),
  timeout: z.coerce.number().int().min(0).max(30_000).default(5_000),
}).refine((q) => !q.since || !q.until || Date.parse(q.since) <= Date.parse(q.until),
  issue('since_after_until', 'since must be before until', ['until']))
// wait=true: returns as soon as >= 1 message matches (created after the request when
// `since` is absent), else 408 { error: { code: "wait_timeout" } } after `timeout` ms.

export const MessageSummary = z.object({ id: MessageId,
  connectionId: ConnectionId.nullable(), source: MessageSource, from: AddressOut,
  to: z.array(AddressOut), subject: z.string(), status: DeliveryStatus,
  tags: z.array(Tag), hasAttachments: z.boolean(), createdAt: IsoDateTime })
export const ListMessagesResponse = Page(MessageSummary)

export const MessageEventView = z.object({ id: EventId, type: EventType, origin: EventOrigin,
  recipient: z.string().nullable(), data: z.object({ url: z.string().optional(),
    userAgent: z.string().optional(), reason: z.string().optional(),
    smtpCode: z.number().int().optional() }), occurredAt: IsoDateTime })

export const MessageDetail = MessageSummary.extend({
  cc: z.array(AddressOut), bcc: z.array(AddressOut), replyTo: z.array(AddressOut),
  html: z.string().nullable(), text: z.string().nullable(),
  headers: z.record(z.string(), z.string()), metadata: z.record(z.string(), z.unknown()),
  links: z.array(z.object({ url: z.string(), text: z.string().optional() })),
  attachments: z.array(z.object({ id: AttachmentId, filename: z.string().nullable(),
    contentType: z.string(), contentId: z.string().nullable(), sizeBytes: z.number().int(),
    inline: z.boolean(), downloadUrl: z.string() })),
  recipients: z.array(z.object({ email: z.string(), name: z.string().nullable(),
    kind: RecipientKind, status: DeliveryStatus, reason: z.string().nullable() })),
  events: z.array(MessageEventView),
  rawUrl: z.string(), simulation: z.record(z.string(), z.unknown()).nullable(),
})
// + webhookDeliveries: z.array(WebhookDeliveryView), newest first (#33, see « Webhooks »).

export const TriggerEventRequest = z.discriminatedUnion('type', [
  z.object({ type: z.literal('opened'), recipient: z.email().optional(),
    userAgent: z.string().optional() }),
  z.object({ type: z.literal('clicked'), url: z.url(), recipient: z.email().optional(),
    userAgent: z.string().optional() }),
  // Forced simulated status (owner arbitration 22/11, design brand-1, implemented in #34):
  // updates the recipient status (all recipients when omitted), the message aggregate,
  // the suppression list (hard_bounce, complained; never invalid, D283) and fans out
  // webhooks like a drawn status.
  z.object({ type: z.literal('status'), status: SimulatedStatus,
    recipient: z.email().optional(), reason: z.string().max(500).optional() }),
])   // 202 TriggerEventResponse { events, webhookDeliveries: [{ id, endpointId }] }
// One event per targeted recipient, origin `api`; omitted `recipient` = every recipient not
// suppressed. Unknown recipient 404, suppressed recipient (or all) 409. A forced status
// does not change the simulation snapshot (D142). Automatic opened / clicked (D143):
// after a simulation run, each recipient it delivered opens when a draw < `openRate` and
// clicks when a draw < `clickRate` and the message has links (a click implies an open),
// 1 ms and 2 ms after `delivered`, origin `simulation`, seeded by the message seed.

export const PurgeQuery = z.object({ connectionId: ConnectionId.optional(),
  before: IsoDateTime.optional(), includeLogs: QueryBool.default(true) })
export const PurgeResponse = z.object({ count: z.number().int().min(0) })

// suppression.ts
export const SuppressionId = prefixedId('sup')
export const SuppressionReason = z.enum(['hard_bounce', 'complained', 'manual'])
export const ListSuppressionsQuery = z.object({ email: z.string().optional(), // substring
  limit: PageLimit, cursor: SuppressionId.optional() })
export const DeleteSuppressionsQuery = z.object({ email: Email.optional() }) // omitted = all
export const SuppressionView = z.object({ id: SuppressionId, email: z.string(),
  reason: SuppressionReason, messageId: MessageId.nullable(),
  connectionId: ConnectionId.nullable(),    // connection of that message (D214)
  createdAt: IsoDateTime })
export const ListSuppressionsResponse = Page(SuppressionView)
  .extend({ total: z.number().int().min(0) })   // addresses matching the filter (D214)

// demo.ts (#62, propositions D210 to D212)
export const DemoLocale = z.enum(['en', 'fr'])
export const SeedDemoRequest = z.object({ locale: DemoLocale.default('en') })
export const SeedDemoResponse = z.object({ count: z.number().int().min(0),
  messageIds: z.array(MessageId) })                // oldest first
export const DeleteSuppressionsResponse = z.object({ count: z.number().int().min(0) })
```

Suppression list (#23, proposition D75):
- The simulation adds an address when it writes `hard_bounce` or `complained` for it
  (reason = that status, `messageId` = the message). An address already listed keeps its
  first row.
- Ingestion stores a listed recipient `suppressed` with a `suppressed` event (canonical
  `email.suppressed`); a message whose recipients are all listed gets no job (D55).
- `GET /capture/suppressions`: newest first, keyset cursor (the id of the last row),
  `email` is a literal case-insensitive substring. `DELETE /capture/suppressions?email=`
  removes one address (exact, lower-cased), without `email` the whole list of the
  workspace; both answer `{ count }`. Every page carries `total` (addresses matching the
  filter) and each row the `connectionId` of the message that put it there (null without
  message or connection), D214.

Demo messages (#62, propositions D210 to D212): `POST /capture/demo` (`SeedDemoRequest`,
201 `SeedDemoResponse`) stores eight transactional messages of a fictional product in the
workspace, in English or French, through the ingestion pipeline (`persistEmails`: raw EML,
blobs, links, suppression check, simulation jobs, webhook fan-out, `message.created`
frames). They are spread over the last hour (`created_at` 52 to 3 minutes ago), over the
enabled connections of the workspace in turn (source = the connection kind; no connection:
`native` without connection), with links, HTML, a PDF and a CSV attachment, an inline
`cid:` image, several recipients, tags `category` and `demo: true`, `metadata.demo`. Each
message carries its planned outcomes as a temporary rule set in `messages.simulation.rules`
(delivered, `hard_bounce` 550, `complained`, `soft_bounce` 452, `failed`, then `*` →
`delivered`), read by the settings planner ahead of every stored layer for that message only
(D211), so the statuses do not depend on the workspace settings and no override is touched.
Seeding twice adds the set twice; bounced addresses then come out `suppressed`. Each message
comes with the log line that would have created it (D228): an `api_logs` row in the dialect
of its connection (or `native`), or an accepted `smtp_sessions` row for an SMTP connection,
at the time of the message, so the viewer links it to the logs explorer. The web UI
calls the same service through `loadDemoMessagesFn` (session) with the UI locale.

Capture behaviour (#15, owner decisions D59 to D61 of 23/11):
- Isolation: every query is scoped to the authenticated workspace (D12, D41). A message or
  attachment of another workspace answers 404 `not_found`, exactly like a missing id; a purge
  never deletes rows of another workspace (`{ count: 0 }`).
- `wait=true` long polls (#26, `capture/wait.ts`): it subscribes to the workspace bus
  channel *before* the first query, answers the first page as soon as it is not empty, and
  re-runs the query on every frame of the workspace (a `status` filter may start matching
  after a simulation), coalesced while one runs. Without `since`, `since` = the request
  time (a message counts from its `created_at`, set when the request that sent it was
  prepared). No match within `timeout` ms (0 .. 30 000, default 5 000): 408
  `wait_timeout`; workspace deleted meanwhile: 404 `not_found`. The 422
  `wait_not_supported` refusal of D59 is lifted.
- Filters: `to`, `from` and `subject` are case-insensitive substrings (`to` matches any
  recipient email or name, `to`, `cc` or `bcc`); `tag=name` matches any value, `name:value`
  splits on the first colon; `since` and `until` are inclusive; `q` is Postgres full text
  (`simple` config, `websearch_to_tsquery` syntax) on subject, text and HTML bodies.
- Pagination: newest first, keyset on `(created_at, id)`. `nextCursor` is opaque
  (base64url); a cursor the server did not produce answers 422 (`invalid_cursor`).
- `hasAttachments` counts `disposition = attachment` parts only (inline `cid:` images do not).
- `GET …/raw` answers `message/rfc822` with `Content-Disposition: attachment;
  filename="<id>.eml"`, 404 when no raw source was kept. `GET …/attachments/:attId` answers
  the stored content type (`application/octet-stream` when malformed) and the stored
  disposition with an RFC 6266 filename. Both downloads carry `X-Content-Type-Options:
  nosniff`, `Content-Security-Policy: sandbox; default-src 'none'` and `Cache-Control:
  private, no-store`: captured content is untrusted and served from the app origin.
- `DELETE /capture/messages` deletes messages (recipients, attachments and events cascade)
  in one transaction. With `includeLogs=true` (default) it also deletes the API logs and
  SMTP sessions in the same scope (`connectionId`, `before`) and the webhook deliveries of
  the purged messages. Orphan blobs are left to the retention job.

## Stream (`GET /capture/stream`)

`text/event-stream`, heartbeat comment every 15 s, `id:` = event id, `Last-Event-ID`
replays from `message_events` (bounded to 500). Query: `connectionId?`, `types?`.

Behaviour (#26, propositions D80 to D84):
- Workspace scope auth (D12). Response headers `Content-Type: text/event-stream;
  charset=utf-8`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`. The
  stream opens with `retry: 3000` and a `: connected` comment, then a `: ping` comment
  every 15 s.
- Frames carry no `event:` field (every frame reaches `EventSource.onmessage`); `data:` is
  one `StreamEvent` JSON, told apart by `type`.
- One `message_events` row gives one frame whose `id:` is the row id, live and on replay:
  `accepted` -> `message.created` (current summary), any other type -> `message.event`
  (with the `messageId` of its message, D205).
  Derived frames have no `id:` and are never replayed: the aggregated `message.status`
  (`recipient: null`) after a simulation run, `messages.purged`, `override.changed`,
  `workspace.deleted`, `log.api`, `log.smtp`, `webhook.delivery`.
- Publishers: ingestion after its transaction committed (`message.created`, one
  `message.event` per suppressed recipient, one `webhook.delivery` per `email.suppressed`
  delivery, D153; nothing for an idempotent replay); the `simulate_delivery` job handler
  (`sent` and final event per recipient, then the aggregated status, then the automatic
  `opened` / `clicked` events and one `webhook.delivery` per delivery the run created,
  D152); `POST /capture/messages/:id/events` (one `message.event` per event, the
  aggregated `message.status` when a forced status changed it, one `webhook.delivery` per
  delivery, D142); the `deliver_webhook` job handler after each attempt, the test send and
  the replay (`webhook.delivery`, D144); `DELETE /capture/messages` (`messages.purged`); the Override API
  after every successful activation and reset, an idempotent reset included, and the
  override expiry scheduler once per workspace that lost an override in a pass
  (`override.changed` with the new `OverrideState`, `connectionId` = the changed scope,
  null for the workspace or when both scopes expired together; nothing when nobody
  listens, D96); the ephemeral GC and `DELETE /admin/workspaces/:id`
  (`workspace.deleted`, then the stream closes and `wait=true` answers 404, D97); the log
  writer once a row is stored (`log.api` per logged call, `log.smtp` per SMTP session,
  only for rows bound to a workspace; derived frames, no `id:`, D145).
- `Last-Event-ID` (an `evt_…` id, anything else ignored): the bus subscription is taken
  first and buffered while the replay reads the 500 rows after that id in `(occurred_at,
  id)` order; buffered frames already replayed are dropped. An id the workspace does not
  know replays nothing. A client more than 500 events behind resyncs through
  `GET /capture/messages`.
- Filters: `types` (comma-separated or repeated `StreamEventType`); `connectionId` drops
  message frames of other connections (and of none); `messages.purged`,
  `override.changed` and `workspace.deleted` always pass.
- A client that stops reading while 1 000 frames are queued is disconnected.
- `connectionId` keeps the `log.api` and `log.smtp` frames of that connection only (a
  call or session without connection is dropped, like a message without one).
- `webhook.delivery` frames carry the `connectionId` of the endpoint scope: a Workspace
  endpoint's frames are dropped by a `connectionId` filter (D144).

```ts
export const StreamEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('message.created'), message: MessageSummary }),
  z.object({ type: z.literal('message.status'), messageId: z.string(),
    status: DeliveryStatus, recipient: z.string().nullable() }),
  z.object({ type: z.literal('message.event'), messageId: MessageId, event: MessageEventView }),
  z.object({ type: z.literal('webhook.delivery'), delivery: WebhookDeliveryView }),
  z.object({ type: z.literal('log.api'), log: ApiLogSummary }),
  z.object({ type: z.literal('log.smtp'), session: SmtpSessionSummary }),
  z.object({ type: z.literal('override.changed'), state: OverrideState }),
  z.object({ type: z.literal('messages.purged'), count: z.number() }),
  z.object({ type: z.literal('workspace.deleted'), workspaceId: WorkspaceId }),
])
export const StreamQuery = z.object({ connectionId: ConnectionId.optional(),
  types: z.preprocess((v) => (typeof v === 'string' ? v.split(',') : v),
    z.array(StreamEventType)).optional() })
```

## MCP (`POST /mcp`, `mailsink mcp`, #44, D165 to D169, proposition D180)

`packages/mcp` holds the server factory and the tools (transport-agnostic, one server bound
to one authenticated workspace) and `handleMcpRequest(request, { db, bus, workspace,
publicUrl })`, the
stateless Streamable HTTP handler. The app route wraps it in `defineApi({ auth: 'workspace'
})`. Tool input schemas are built from the contracts below (`packages/mcp/src/schemas.ts`):

```ts
const { wait, timeout, ...messageFilters } = ListMessagesQuery.shape
export const ListEmailsInput = z.object(messageFilters)          // list_emails
export const WaitForEmailInput = z.object({ ...messageFilters,   // wait_for_email
  timeout: z.number().int().min(0).max(WAIT_TIMEOUT_MAX_MS).default(WAIT_TIMEOUT_MAX_MS) })
export const GetEmailInput = z.object({ id: MessageId })          // get_email, get_email_source
export const GetEmailAttachmentInput = z.object({ id: MessageId,  // get_email_attachment
  attachmentId: AttachmentId })
export const TriggerEmailEventInput = z.object({ id: MessageId,   // trigger_email_event
  event: TriggerEventRequest })
export const SetOverrideInput = ActivateOverrideRequest           // set_override_config
// reset_override_config: ResetOverrideRequest · get_override_config: {}
// purge_emails: PurgeQuery · list_suppressions: ListSuppressionsQuery
export const GetDeliveryLogsInput = z.object({                    // get_delivery_logs
  source: z.enum(['api', 'smtp']).default('api'), id: z.string().optional(),
  apiFilters: ListApiLogsQuery.optional(), smtpFilters: ListSmtpSessionsQuery.optional() })
export const GetWebhookDeliveriesInput = ListWebhookDeliveriesQuery.extend({
  id: WebhookDeliveryId.optional() })                             // get_webhook_deliveries
```

| Tool | Service (same as) | Annotations |
| --- | --- | --- |
| `list_emails` | `listCapturedMessages` (`GET /capture/messages`) | read only |
| `get_email` | `getCapturedMessage` (`GET /capture/messages/:id`), absolute `rawUrl` and `downloadUrl` | read only |
| `get_email_source` | `readRawMessage` (`GET /capture/messages/:id/raw`) | read only |
| `get_email_attachment` | `readAttachment` (`GET /capture/messages/:id/attachments/:attId`) | read only |
| `wait_for_email` | `waitForMessages` (`wait=true`), aborted with the call | read only |
| `trigger_email_event` | `triggerAndPublishEvent`, origin `mcp` | open world (webhooks) |
| `set_override_config` | `activateAndPublishOverride`, via `mcp` | |
| `reset_override_config` | `resetAndPublishOverride` | idempotent |
| `get_override_config` | `getOverrideState` | read only |
| `purge_emails` | `purgeAndPublish` | destructive |
| `get_delivery_logs` | `listApiLogViews` / `getApiLogView`, `listSmtpSessionViews` / `getSmtpSessionView` | read only |
| `get_webhook_deliveries` | `listWebhookDeliveryViews` / `getWebhookDeliveryDetail` | read only |
| `list_suppressions` | `listSuppressionViews` | read only |

Behaviour:
- **Transport** (D165): `POST /mcp` only, stateless (no `Mcp-Session-Id`); `GET` and `DELETE`
  answer 405 `Allow: POST`. The SDK answers JSON-RPC over an SSE response (keep-alive
  comments during a long `wait_for_email`); the request log keeps the request body and no
  response body for SSE (D146). Auth, activity and the log row are those of every
  `defineApi()` route (dialect `mcp`).
- **Publishing** (D180): the state-changing tools call the same `core` services as their
  HTTP twins, which publish on the bus after commit (events, aggregate status, webhook
  deliveries, `override.changed`, `messages.purged`), so the UI and SSE streams see them.
- **Content** (D180): `get_email_source` answers a JSON summary (`id`, `url`, `contentType`,
  `sizeBytes`) then an embedded resource `{ uri: <absolute raw URL>, mimeType:
  'message/rfc822', text }`; `get_email_attachment` a summary (`filename`, `contentType`,
  `disposition`, `sizeBytes`, `url`, `encoding`) then `{ uri, mimeType, text }` for text
  types (`text/*`, JSON, XML) or `{ uri, mimeType, blob }` (base64) otherwise. The URLs
  answer the same key as `/mcp`.
- **Version** (D181): `serverInfo` is `{ name: 'mailsink', version: MAILSINK_VERSION }`.
- **Answers** (D166): the HTTP JSON as text and as `structuredContent`. Failures are
  `isError` results whose text is the HTTP error body (`not_found`, `wait_timeout`,
  `validation_error` with `details.in = 'arguments'`…). English only (D19).
- **Workspace deletion** (D169): `workspace.deleted` ends a pending `wait_for_email` with
  `not_found`; whatever still runs 1 s later is cut and the response stream closed.
- **stdio** (D14, D169): `mailsink mcp [--url] [--key] [--workspace]` (env `MAILSINK_URL`,
  `MAILSINK_KEY`, `MAILSINK_WORKSPACE`) forwards newline-delimited JSON-RPC from stdin to
  `<url>/mcp` and writes the answers on stdout; a refused or unreachable request gets a
  JSON-RPC error `-32000`. Client configuration: `docs/guides/mcp.md`.

## Logs (`logs.ts`, #35, D145 to D147, D151, D156, D157)

```ts
export const ApiDialect = z.enum(['native', 'resend', 'brevo', 'admin', 'capture', 'mcp'])
export const SmtpOutcome = z.enum(['accepted', 'rejected', 'auth_failed', 'error'])
export function NumberedPage<T extends z.ZodType>(item: T) {
  return z.object({ data: z.array(item), total: z.number().int().min(0),
    page: z.number().int().min(1), pageSize: z.number().int().min(1) })
}
const paging = { page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50) }
export const StatusFilter = z.string().regex(/^[1-5](\d\d|xx)$/)      // 404 or 4xx

export const ListApiLogsQuery = z.object({ connectionId: ConnectionId.optional(),
  dialect: csv(ApiDialect).optional(), status: csv(StatusFilter).optional(),
  errorCode: z.string().optional(), method: z.string().optional(),  // upper-cased
  path: z.string().optional(),                                      // substring, case-insensitive
  messageId: MessageId.optional(), since: IsoDateTime.optional(), until: IsoDateTime.optional(),
  sort: z.enum(['createdAt', '-createdAt', 'durationMs', '-durationMs', 'statusCode',
    '-statusCode']).default('-createdAt'), ...paging })             // + since <= until
export const ApiLogSummary = z.object({ id: ApiLogId, connectionId: ConnectionId.nullable(),
  dialect: ApiDialect, method: z.string(), path: z.string(), statusCode: z.number().int(),
  durationMs: z.number().int().min(0), errorCode: z.string().nullable(),
  messageIds: z.array(MessageId), createdAt: IsoDateTime })
export const ApiLogDetail = ApiLogSummary.extend({
  requestHeaders: z.record(z.string(), z.string()),                 // credentials redacted
  requestBody: z.unknown().nullable(), responseBody: z.unknown().nullable(),
  responseHeaders: z.record(z.string(), z.string()), // D215, {} before migration 0003
  ip: z.string().nullable() })
export const ListApiLogsResponse = NumberedPage(ApiLogSummary)

export const ListSmtpSessionsQuery = z.object({ connectionId: ConnectionId.optional(),
  outcome: csv(SmtpOutcome).optional(),
  q: z.string().optional(),            // substring of remote address, client hostname, AUTH user
  messageId: MessageId.optional(), since: IsoDateTime.optional(), until: IsoDateTime.optional(),
  sort: z.enum(['startedAt', '-startedAt']).default('-startedAt'), ...paging })
export const TranscriptLine = z.object({ at: z.number(), dir: z.enum(['C', 'S']), line: z.string() })
export const SmtpSessionSummary = z.object({ id: SmtpSessionId,
  connectionId: ConnectionId.nullable(), remoteAddress: z.string(),
  clientHostname: z.string().nullable(), authUser: z.string().nullable(), secure: z.boolean(),
  outcome: SmtpOutcome, error: z.string().nullable(), messageIds: z.array(MessageId),
  startedAt: IsoDateTime, endedAt: IsoDateTime.nullable() })
export const SmtpSessionDetail = SmtpSessionSummary.extend({ transcript: z.array(TranscriptLine) })
export const ListSmtpSessionsResponse = NumberedPage(SmtpSessionSummary)
```

Behaviour:
- **What is logged** (D145): every `defineApi()` call of `/v1`, `/emails`, `/v3`, `/admin`,
  `/capture` and `/mcp`, refused calls included (`unauthorized`, `forbidden`,
  `validation_error`, `rate_limited`, `chaos_injected`…, `error_code` = the error code).
  Not logged: `GET /capture/logs/**` and `GET /admin/logs/**` (reading the logs would log
  itself and, through `log.api`, make a live log view refetch forever), `GET
  /capture/stream` (long-lived) and `/healthz`. The row id is the `X-Request-Id` of the
  call. Admin calls and failed authentications have no workspace: they are kept (default
  retention, D49) and read through `GET /admin/logs/api[/:id]` (Admin key, same query and
  views as `/capture/logs/api`, D151, D156); no route reads the SMTP sessions without
  workspace yet.
- **How** (D146): the `request-log` extension runs first in `DEFAULT_EXTENSIONS`. Once the
  caller is authenticated, its `afterAuth` marks a JSON or text body as wanted; at
  response time the log takes the bytes the handler already buffered (`limitBody`), else
  reads the body nothing consumed (bounded by `MAILSINK_MAX_MESSAGE_BYTES`), so a call
  refused by a later extension still logs its body and no body is read twice (D157); a
  body cut by the 413 cap logs `null`. `ip` is the socket address srvx gives the request
  (verified on the build), or with `MAILSINK_TRUST_PROXY=true` the last `X-Forwarded-For`
  entry (D182, D185). `onResponse` clones a JSON or text response (bounded to 1 MiB) and hands
  the row to the runtime log writer, which inserts it after the response left. A failed
  write is logged on the server, never sent. Redaction and truncation rules: doc 02,
  « `schema/logs.ts` ». `durationMs` is measured up to the built response.
- **SMTP** (#31 wires it): the SMTP server calls `runtime.logs.recordSmtpSession(session)`
  once per finished session with `{ workspaceId?, connectionId?, remoteAddress,
  clientHostname?, authUser?, secure, transcript, messageIds, outcome, error?, startedAt,
  endedAt }`; the writer caps and redacts the transcript (doc 02).
- **Reads** (D147): workspace scope (D12); a row of another workspace answers 404
  `not_found` like a missing id. Filters combine with AND, `status`, `dialect` and
  `outcome` values with OR; `since` and `until` are inclusive on `createdAt` (API) or
  `startedAt` (SMTP). Page-number pagination (`page`, `pageSize` up to 200) with the
  `total` for the pager of the UI DataTable (`LogsSearch`); ties of the sort column are
  broken by id. The list returns summaries; headers, bodies and transcripts come with
  `GET …/:id`.
- **Purge**: `DELETE /capture/messages?includeLogs=true` (default) deletes the rows in
  the same scope; the retention pass expires them with the message retention (D49).

## Webhooks (`webhook.ts`)

**Strict decoupling (D20).** The ingestion channel (how an email entered: native API,
Resend, Brevo, SMTP) never decides the webhook shape. Only the endpoint's
`payloadFormat` does. A Brevo-ingested email can be notified in Resend format, an SMTP
email in Brevo format, and so on.

### Endpoint contract

```ts
export const PayloadFormat = z.enum(['unified', 'resend', 'brevo'])

export const WebhookEndpointInput = z.object({
  connectionId: z.string().startsWith('con_').nullable(),  // null = Workspace scope
  url: z.url(),
  payloadFormat: PayloadFormat.optional(),                 // default: see below
  // Event names in the dialect of payloadFormat (or canonical names, always accepted).
  // Normalized to canonical with toCanonical(); unknown names -> 422.
  events: z.array(z.string()).min(1),
  description: z.string().max(200).optional(),
  brevoAuth: z.discriminatedUnion('type', [
    z.object({ type: z.literal('none') }),
    z.object({ type: z.literal('bearer'), token: z.string().min(1) }),
    z.object({ type: z.literal('basic'), username: z.string(), password: z.string() }),
  ]).optional(),                                           // brevo format only
  customHeaders: z.array(z.object({ key: z.string(), value: z.string() })).max(10)
    .optional(),
})
// unified / resend: secret generated server-side (whsec_<base64 24 bytes>), shown once,
// rotatable. brevo: Brevo signs nothing; the receiver authenticates with brevoAuth.

/** Creation default (D20): connection kind for resend/brevo, else unified. */
export function defaultPayloadFormat(scope: { kind: ConnectionKind } | null): PayloadFormat {
  return scope && scope.kind !== 'smtp' ? scope.kind : 'unified'
}

export const WebhookEndpointView = z.object({
  id: z.string(), numericId: z.number().int(),  // numericId = Brevo payload `id`
  connectionId: z.string().nullable(), url: z.string(),
  payloadFormat: PayloadFormat,
  events: z.array(z.string()),            // dialect names of payloadFormat, deduplicated
  canonicalEvents: z.array(CanonicalEvent),
  unsupportedEvents: z.array(CanonicalEvent), // canonical events this format cannot emit
  description: z.string().nullable(),
  brevoAuth: z.object({ type: z.enum(['none', 'bearer', 'basic']),
    username: z.string().optional() }),   // credentials are never returned
  customHeaders: z.array(CustomHeader),
  secretPreview: z.string().nullable(), enabled: z.boolean(),
  createdAt: IsoDateTime, updatedAt: IsoDateTime,
})
// POST answers 201 WebhookEndpointWithSecret (= view + `secret`, the clear whsec_ shown
// once, null for brevo); PATCH answers it too, `secret` set only when one was issued.
export const WebhookEndpointPatch = WebhookEndpointInput.partial()
  .extend({ description: z.string().max(200).nullable().optional(),
    rotateSecret: z.literal(true).optional() })
```

`webhook-delivery.ts` holds the delivery log contracts:

```ts
export const WebhookDeliveryView = z.object({ id: WebhookDeliveryId,
  endpointId: WebhookEndpointId, messageId: MessageId.nullable(),
  eventId: EventId.nullable(),                       // null for a test send
  payloadFormat: PayloadFormat, canonicalEvent: CanonicalEvent, dialectEvent: z.string(),
  recipient: z.string().nullable(),
  status: z.enum(['pending', 'retrying', 'succeeded', 'failed']),
  attemptCount: z.number().int(), nextAttemptAt: IsoDateTime.nullable(),
  lastStatusCode: z.number().int().nullable(),
  replayOf: WebhookDeliveryId.nullable(), replayMode: ReplayMode.nullable(),
  endpointUrl: z.string().nullable(),   // current URL of the endpoint (D205)
  durationMs: z.number().int().nullable(), // last attempt; null before the first one
  createdAt: IsoDateTime })
export const WebhookDeliveryDetail = WebhookDeliveryView.extend({ body: z.string(),
  contentType: z.string(), attempts: z.array(WebhookAttemptView) }) // attempt: id,
  // attemptNo, requestHeaders (exactly as sent), signedAt, responseStatus,
  // responseBody (4 KB), durationMs, error, createdAt
export const ListWebhookDeliveriesQuery = z.object({ endpointId, payloadFormat,
  messageId, status, limit: PageLimit, cursor: WebhookDeliveryId,     // all optional
  page: z.coerce.number().int().min(1).max(100_000) })  // D213: page numbers, cursor ignored
export const ListWebhookDeliveriesResponse = Page(WebhookDeliveryView)
  .extend({ total: z.number().int().min(0) })           // deliveries matching the filters
```

Behaviour (#32, #33, #34, D135 to D144, D150 to D155):
- Endpoint CRUD: `GET /capture/webhooks[?connectionId=]` lists that scope and the
  Workspace scope, oldest first; another workspace's endpoint or connection is a 404.
  Event names are validated against the resolved format: dialect names, canonical names,
  and for Brevo the aliases `sent`, `soft_bounce`, `hard_bounce`; an unknown name is a 422
  with `params.code = unknown_webhook_event`. `brevoAuth` other than `none` on another
  format is refused (`brevo_auth_requires_brevo`); custom headers may not use
  `content-type`, `content-length`, `host`, `authorization`, `svix-*` or `x-mailsink-*`
  (`reserved_webhook_header`) and are sent on every format, under the format's own
  headers. Basic auth written in a brevo `url` (`https://user:pass@host/…`, create or
  `PATCH`, D278) is taken out of the URL and stored as `brevoAuth` basic (percent-decoded),
  so neither the endpoint view, the delivery log nor the attempts show it in the URL;
  another format answers `url_credentials_require_brevo`, URL credentials next to a bearer
  or basic `brevoAuth` answer `conflicting_webhook_auth` (both 422 on `url`). `DELETE` answers `{ id }` (its deliveries cascade). With
  `MAILSINK_WEBHOOK_BLOCK_PRIVATE=true`, a `url` (create or `PATCH`) whose host is, or
  resolves to, a private, loopback or link-local address is a 422 on `url` with
  `params.code = private_webhook_url` (D150, D155).
- Secrets: the unified HMAC key is the whole `whsec_…` string; `secretPreview` is the
  prefix plus 4 characters. `PATCH { rotateSecret: true }` issues a new one; leaving the
  brevo format issues one too, entering it drops it (Brevo credentials live in the same
  column: the token, or `user:password`).
- Fan-out: in the transaction that writes the events. Ingestion fans out its `suppressed`
  events (`email.suppressed`, Brevo `blocked`, D153); a simulation run fans out its events
  and the automatic opened / clicked below (D152); manual events fan out with them.
  Disabled endpoints get no new delivery.
- Attempts: one `deliver_webhook` job per attempt (payload `{ deliveryId, attemptNo,
  exactAttemptId? }`); a failed attempt enqueues the next one itself after
  `min(2^(n-1) * 5 s, 1 h) ± 20 %`, the queue backoff (D47) only covers database errors.
  Redirects are not followed (a 3xx fails); network errors and timeouts are stored in the
  attempt `error`. A job whose attempt is already recorded does nothing. With
  `MAILSINK_WEBHOOK_BLOCK_PRIVATE=true`, each attempt first resolves the URL host: a
  blocked address makes the attempt fail at once, final and never sent
  (`error: blocked: <host> resolves to …`, D155); this covers the test send and replays.
- Retention (D154): a finished delivery (`succeeded`, `failed`) and its attempts are
  purged by the retention pass once older than the retention of the endpoint scope (the
  connection's when it sets one, else the workspace's); deliveries in flight wait.
- Replay: `replayOf` always points to the first delivery, whose id stays the signing id
  (`svix-id`, `X-Mailsink-Delivery-Id`). `exact` copies the headers of one attempt for
  every attempt of the replay; on a delivery without attempts it is a 409 (use `resign`).
  The answer is 202 with the pending delivery; the worker sends it.
- `POST /capture/webhooks/:id/test` (`{ event? }`, default `email.delivered`, dialect or
  canonical name): a sample message, a delivery with `messageId` and `eventId` null, one
  attempt sent at once and never retried; answers the `WebhookDeliveryDetail`.
- Preview: signed with a throwaway secret, then `X-Mailsink-Signature`, `svix-signature`
  and `Authorization` values are masked (`••••••••`). An event the format cannot emit is
  a 422.
- Stream: a `webhook.delivery` frame (no `id:`) when a delivery is created and after each
  attempt; its `connectionId` is the endpoint scope, so a Workspace-scoped endpoint's
  frames are dropped by a `connectionId` stream filter.
- `MessageDetail.webhookDeliveries`: the message's deliveries, newest first (at most
  200). The delivery log is newest first with a keyset cursor (the last id).
- Formatter fields: Resend `email_id` is the provider id when it is a UUID, else the UUID
  body of the `msg_` id; Brevo `message-id` is the provider id when shaped `<…@…>`, else
  `<uuid@smtp-relay.mailin.fr>`; Brevo `tags` are the tag values (the name when the value
  is empty); Resend `click.ipAddress` is `127.0.0.1`.

Changing `payloadFormat` (PATCH) keeps the canonical subscription. Events the new format
cannot represent stay stored but are listed in `unsupportedEvents` and never emitted; the
UI warns before saving (D22).

### Event mapping (`webhooks/events-map.ts`)

Stored form is always canonical. `toCanonical(format, name)` expands one dialect name to
one or more canonical events (subscription), `toDialect(format, canonical)` gives the
emitted name or `null` (not emitted).

| Canonical | `unified` | `resend` (`type`) | `brevo` subscription / payload `event` |
|---|---|---|---|
| `email.sent` | `email.sent` | `email.sent` | `request` (alias `sent`) / `request` |
| `email.delivered` | `email.delivered` | `email.delivered` | `delivered` / `delivered` |
| `email.deferred` | `email.deferred` | `email.delivery_delayed` | `deferred` / `deferred` |
| `email.soft_bounced` | `email.soft_bounced` | `email.delivery_delayed` | `softBounce` / `soft_bounce` |
| `email.hard_bounced` | `email.hard_bounced` | `email.bounced` (`bounce.type: "Permanent"`) | `hardBounce` / `hard_bounce` |
| `email.complained` | `email.complained` | `email.complained` | `spam` / `spam` |
| `email.opened` | `email.opened` | `email.opened` | `opened` / `opened` |
| `email.clicked` | `email.clicked` | `email.clicked` | `click` / `click` |
| `email.suppressed` | `email.suppressed` | not emitted | `blocked` / `blocked` |
| `email.failed` | `email.failed` | `email.failed` | `error` / `error` |
| `email.invalid` | `email.invalid` | `email.failed` (`failed.reason`) | `invalid` (alias `invalid_email`) / `invalid_email` |

Facts behind the non-obvious lines (checked against provider docs on 22/11/2026):
Resend `email.bounced` means a *permanent* rejection and `email.delivery_delayed` a
*temporary* issue, so soft bounces map to `delivery_delayed`; Resend has no per-send
suppression event (`suppression.added` describes the list, not a send). Brevo subscription
names (`hardBounce`, `softBounce`) differ from the payload `event` values (`hard_bounce`,
`soft_bounce`): both directions are mapped. `email.failed` is a canonical addition for the
simulated `failed` status (Resend parity). Owner-approved on 22/11 (D22).

Invalid recipient address (D277, owner 24/11, #153; checked against the provider docs on
24/11/2026): Mailsink simulates the providers faithfully, so Brevo's two failure events
both exist. `email.invalid` is the simulated `invalid` status (rates, recipient rules such
as `*+invalid@*`, forced status): Brevo `invalid_email` (subscription `invalid`, alias
`invalid_email`). `email.failed` is Brevo `error`, whose payload Brevo documents but whose
subscription name its webhook API does not list: Mailsink accepts `error` (D280). The
official SDK (`@getbrevo/brevo`) does not type `error` among the `createWebhook` events, so a
TypeScript client casts the value to subscribe to it. Resend
has no invalid-address event and documents invalid recipients under `email.failed`, so
both canonical events are emitted as `email.failed` (reason `Invalid recipient address`
for `email.invalid` when none is given), and subscribing to Resend `email.failed` stores
both (a dialect name of the format wins over a canonical name in `toCanonical`). Neither
status feeds the suppression list: Brevo's blocked contacts only know hard bounces, spam
complaints, unsubscriptions and admin blocks (D283).

Reverse mapping is many-to-one on purpose: subscribing to Resend
`email.delivery_delayed` stores `email.deferred` + `email.soft_bounced`, and Resend
`email.failed` stores `email.failed` + `email.invalid`.

### Formatter strategy (`packages/core/src/webhooks/formatters/`, D21)

```ts
export interface WebhookContext {
  delivery: { id: string; numericEndpointId: number }
  workspace: { id: string; slug: string; timezone: string }
  connection: { id: string; kind: ConnectionKind } | null
  message: MessageForWebhook                         // ids, from, to, subject, tags,
                                                     // metadata, createdAt, templateId
  event: { canonical: CanonicalEvent; occurredAt: Date; recipient: string | null
           detail: { reason?: string; smtpCode?: number; url?: string; userAgent?: string } }
}

export interface WebhookFormatter {
  readonly format: PayloadFormat
  /** Emitted name, or null when this format has no equivalent (delivery skipped). */
  eventName(canonical: CanonicalEvent): string | null
  /** Serialized once per delivery; the stored string is what is signed and sent. */
  serialize(ctx: WebhookContext): string
  /** Called per attempt; returns every header to send (content-type included). */
  sign(input: { deliveryId: string; body: string; endpoint: EndpointSecrets
                timestamp: number; canonical: CanonicalEvent }): Record<string, string>
}

export const formatters: Record<PayloadFormat, WebhookFormatter> = {
  unified: unifiedFormatter, resend: resendFormatter, brevo: brevoFormatter,
}
```

Files: `types.ts`, `events-map.ts`, `unified.ts`, `resend.ts`, `brevo.ts`, `index.ts`, one
contract test file per formatter (Resend payloads verified with the `svix` package's
`Webhook.verify`).

#### `UnifiedWebhookFormatter`

```ts
export const UnifiedWebhookPayload = z.object({
  id: z.string(),                                    // whd_…
  event: CanonicalEvent,
  occurredAt: z.iso.datetime(),
  workspaceId: z.string(),
  connectionId: z.string().nullable(),
  connectionKind: z.enum(['resend', 'brevo', 'smtp']).nullable(), // null: native API
  messageId: z.string(),                             // msg_…
  providerMessageId: z.string(),
  recipient: z.string().nullable(),
  from: z.string(), to: z.array(z.string()), subject: z.string(),
  tags: z.array(Tag),
  metadata: z.record(z.string(), z.unknown()),
  detail: z.object({ reason: z.string().optional(), smtpCode: z.number().optional(),
    url: z.string().optional(), userAgent: z.string().optional() }),
})
```

```
Content-Type: application/json
X-Mailsink-Event: email.hard_bounced
X-Mailsink-Delivery-Id: whd_…
X-Mailsink-Timestamp: 1795430400
X-Mailsink-Signature: sha256=<hex hmac_sha256(secret, "<timestamp>.<body>")>
```

The timestamp is part of the signed string so a receiver can reject stale replays
(D24).

#### `ResendWebhookFormatter`

```ts
export const ResendWebhookPayload = z.object({
  type: z.enum(['email.sent', 'email.delivered', 'email.delivery_delayed',
    'email.complained', 'email.bounced', 'email.opened', 'email.clicked', 'email.failed']),
  created_at: z.iso.datetime(),
  data: z.object({
    email_id: z.string(),                            // Resend-style uuid of the message
    from: z.string(), to: z.array(z.string()), subject: z.string(),
    created_at: z.iso.datetime(),
    tags: z.record(z.string(), z.string()).optional(),
    bounce: z.object({ message: z.string(), type: z.literal('Permanent'),
      subType: z.string() }).optional(),
    click: z.object({ link: z.string(), ipAddress: z.string(), userAgent: z.string(),
      timestamp: z.iso.datetime() }).optional(),
    failed: z.object({ reason: z.string() }).optional(),
  }),
})
```

```
Content-Type: application/json
svix-id: whd_…
svix-timestamp: 1795430400
svix-signature: v1,<base64 hmac_sha256(base64decode(secret minus "whsec_"),
                                       "<svix-id>.<svix-timestamp>.<body>")>
```

#### `BrevoWebhookFormatter`

```ts
export const BrevoWebhookPayload = z.object({
  event: z.enum(['request', 'delivered', 'soft_bounce', 'hard_bounce', 'spam', 'opened',
    'click', 'deferred', 'blocked', 'invalid_email', 'error']), // email.invalid, email.failed
  email: z.string(),                                 // the recipient
  id: z.number().int(),                              // webhook id = endpoint numericId
  date: z.string(),                                  // "YYYY-MM-DD HH:mm:ss", workspace tz
  ts: z.number().int(), ts_event: z.number().int(), ts_epoch: z.number().int(),
  'message-id': z.string(),                          // "<…@smtp-relay.mailin.fr>"
  subject: z.string(),
  tag: z.string().optional(),                        // first tag
  tags: z.array(z.string()).optional(),
  template_id: z.number().int().optional(),
  'X-Mailin-custom': z.string().optional(),       // the message header (any case, #149)
  link: z.string().optional(),                       // click
  reason: z.string().optional(),                     // bounces, deferred, blocked
  source: z.enum(['API', 'SMTP']).optional(),
})
```

Brevo does not sign webhooks. Its documented receiver-side protections are the webhook
`auth` (bearer token, or basic auth credentials) and custom `headers`, which Mailsink
emulates:

```
Content-Type: application/json
Authorization: Bearer <token>            # brevoAuth.type = bearer
Authorization: Basic <base64 user:pass>  # brevoAuth.type = basic
<custom header>: <value>                 # customHeaders
```

`X-Sib-Signature` is not part of Brevo's public documentation, so it is not emitted;
adding a non-standard signature would make Mailsink less faithful (D23).

### Delivery lifecycle, retries and replay (D24)

1. A message event fans out to every enabled endpoint whose scope matches
   (`connectionId = message.connectionId` or `null`) and whose canonical subscription
   contains the event, and whose formatter emits it.
2. The formatter serializes **once**; `webhook_deliveries` stores `payloadFormat`,
   `canonicalEvent`, `dialectEvent` and the exact `body` string.
3. Each attempt signs the stored body with the attempt timestamp (Svix behaviour: same
   `svix-id`, fresh `svix-timestamp`), and stores the exact headers sent in
   `webhook_attempts`. Retry: 8 attempts, `delay = min(2^n * 5 s, 1 h) ± 20 %`. A `2xx`
   within 10 s is a success.
4. Replay creates a new delivery (`replayOf`) with the **same body bytes**:

```ts
export const ReplayRequest = z.object({
  mode: z.enum(['exact', 'resign']).default('exact'),
  attemptId: z.string().optional(),   // exact: headers of this attempt (default: last)
})
```

- `exact` (owner request, default): body and headers byte for byte, signature
  included. Caveat shown in the UI: Svix-based verifiers (Resend SDK) reject timestamps
  older than 5 minutes, and receivers may de-duplicate on `svix-id`; that is the point
  when testing replay protection.
- `resign`: same body and same delivery id header, fresh timestamp and
  signature, as the Svix dashboard « resend » does; the receiver accepts it.

`POST /capture/webhooks/preview` takes `{ payloadFormat, event, connectionId? }` and
returns `{ body, headers }` built by the real formatter from a sample message, with the
endpoint secret masked. The UI form uses it for the live preview.

## Errors and rate limit headers

Native/capture/admin error body (`errors.ts`, `ApiErrorBody`):
`{ error: { code, message, details? }, requestId }`, `message` in English (D19).
Codes (`ErrorCode`): `unauthorized`, `forbidden`, `validation_error`, `not_found`,
`conflict`, `idempotency_mismatch`, `rate_limited`, `payload_too_large`, `chaos_injected`,
`wait_timeout`, `internal_error` (unexpected 500). Resend/Brevo dialects map these to their
own body shape: `http/errors.ts` defines the `ErrorFormatter` (body, and an optional
dialect status), each dialect plugs its own from `http/dialects/<dialect>/errors.ts`
(D122, D127, D158). An `unauthorized` error carries `details.credential`: `missing` (no
credential sent) or `invalid` (D158).

HTTP status per code (D40, `core/errors.ts`; a call site may override it, e.g. 400 for an
unreadable body or a malformed auth header):

| Code | Status | Code | Status |
|---|---|---|---|
| `unauthorized` | 401 (+ `WWW-Authenticate: Bearer`) | `rate_limited` | 429 |
| `forbidden` | 403 | `payload_too_large` | 413 |
| `validation_error` | 422 | `chaos_injected` | 500 |
| `not_found` | 404 | `wait_timeout` | 408 |
| `conflict`, `idempotency_mismatch` | 409 | `internal_error` | 500 |

Request body cap (`defineApi` option `maxBodyBytes`, `http/body-limit.ts`, D105): every
route reads its body under a byte cap before any parsing. A declared `Content-Length` over
the cap is refused without reading, a streamed body is cut as soon as it crosses it; both
answer `413 payload_too_large` with `details: { maxBytes }`. The cap is 1 MiB
(`DEFAULT_MAX_BODY_BYTES`) unless the route sets one: Admin and Capture routes keep that
default (their bodies are small JSON documents); ingestion routes (`POST /v1/emails`,
`POST /v1/emails/batch`, Resend `POST /emails` and `/emails/batch`; Brevo
`POST /v3/smtp/email` reads its body under the same cap itself) set
`maxBodyBytes: 'message'`, which resolves to `MAILSINK_MAX_MESSAGE_BYTES` (25 MiB by
default). A number sets a route-specific cap in bytes.

`details` of a `validation_error` (`http/validation.ts`):

```ts
type ValidationDetails = {
  in: 'params' | 'query' | 'body'
  issues: { path: (string | number)[]; code: string; message: string
            params?: { code: string } }[]   // params.code: stable code of a contracts refinement
}
```

Every ingestion response carries `X-RateLimit-Limit`, `X-RateLimit-Remaining`,
`X-RateLimit-Reset` (seconds), plus `Retry-After` on `429`, whenever a rate limit applies
(no headers while the effective `rateLimit` is `null`, D91). The Resend dialect also emits
`ratelimit-limit`/`ratelimit-remaining`/`ratelimit-reset` as Resend does.

### Rate limit and chaos (#24, #25, D90 to D94)

Both run in the `ingestion-guard` extension (`http/ingestion-guard.ts`,
`INGESTION_EXTENSIONS`), on ingestion routes only (native `/v1`, Resend `/emails` and
Brevo `/v3/smtp/email`, each dialect adding its own rate limit headers), never on Admin
nor Capture. Order (04-sequence): authentication, then
the effective settings of the connection (resolver above: connection override > workspace
override > connection > workspace), then the rate limit, then the chaos draw, then body
parsing and ingestion. A refused call reads no body and stores nothing.

- **Token bucket** (`core/rate-limit/token-bucket.ts`, D7): one in-memory bucket per
  connection. Capacity `burst ?? limit`, refilled continuously at `limit / windowSeconds`
  tokens per second. A bucket whose effective settings change (override activated or
  reset) starts over full. Every call that passes authentication spends a token, a call
  later refused by validation or chaos included. Idle full buckets are dropped above
  10 000 buckets.
- **Headers**: `X-RateLimit-Limit` = `limit`, `X-RateLimit-Remaining` = whole tokens left,
  `X-RateLimit-Reset` = seconds until the bucket is full again, `Retry-After` (on `429`) =
  seconds until one token is back (at least 1). Error: `429 rate_limited`,
  `Rate limit exceeded, retry in Ns`.
- **Chaos**: with probability `chaos.errorRate` percent (active override only), the call
  fails with one of `chaos.httpCodes` drawn uniformly (`429`, `500`, `502`, `503`), body
  code `chaos_injected` whatever the status, message `Simulated failure (chaos N)`. Both
  refusals are written to `api_logs` with `error_code` `rate_limited` or `chaos_injected`
  (request log, #35; the former `console.info` line is gone).
- **SMTP** (#31 reuses `guardRequest({ surface: 'smtp' })` and `smtpGuardReply`): rate
  limit `451 4.7.1 Rate limit exceeded, retry in Ns`; chaos `421 4.3.2 Service not
  available`, `451 4.3.0 Local error in processing`, `452 4.3.1 Insufficient system
  storage`, `550 5.7.1 Message rejected`, each suffixed ` (chaos injected)`.
- **Determinism**: the limiter clock (`createRateLimiter({ now })`) and the chaos source
  (`runtime.chaosRandom`) are injectable.
- `rate_limit` columns (workspaces, connections) and `overrides.config.rateLimit` are only
  written from the parsed contract output, so `windowSeconds` is always present.

## OpenAPI (`@mailsink/openapi`, #124, propositions D230 to D234)

An OpenAPI 3.1 document of every public HTTP route, generated from the Zod contracts with
`zod-openapi` (Zod 4 native JSON Schema underneath). It lives in its own package so
`@mailsink/contracts` keeps `zod` as its only dependency (it reaches the browser bundle).

- **Registry** (`packages/openapi/src/registry.ts`): one `RouteSpec` per route and method
  (`routes/*.ts`, one file per surface): `operationId`, OpenAPI path, tag, auth mode,
  params, query, request headers, body and success responses, all contract schemas. The
  handlers do not declare response schemas, so the registry names them (the return types
  of the core services). Request schemas render on the input side (what the client sends,
  before transforms), responses on the output side.
- **Errors** (`errors.ts`, D40): the statuses of a route are derived from its auth (`401`,
  `403`), inputs (`404` with path params, `422`, `400` for an unreadable body or the Admin
  key without `X-Mailsink-Workspace`, `413` with a body), ingestion (`409
  idempotency_mismatch`, `429 rate_limited`, `chaos_injected` on `429`, `500`, `502`,
  `503`), the codes it lists (`conflict`, `wait_timeout`) and `500 internal_error`.
  Dialect bodies: `ApiErrorBody`, `ResendErrorBody` (an unknown key on a read is `400`),
  `BrevoError` (every validation error is `400`).
- **Headers**: `X-Request-Id` on every response, `WWW-Authenticate` on `401`, `Retry-After`
  on `429`, `X-RateLimit-*` (plus `ratelimit-*` for Resend, `x-sib-ratelimit-*` for Brevo)
  and `Idempotent-Replayed` on ingestion; `Idempotency-Key`, `x-batch-validation` and
  `Last-Event-ID` as request headers. Response headers are `components.headers`.
- **Security schemes** (D41): `adminKey`, `connectionKey` (`msk_`), `workspaceKey`
  (`mskw_`), `brevoApiKey` (`api-key` header) and `workspaceHeader`
  (`X-Mailsink-Workspace`, combined with `adminKey` for the workspace scope).
- **Components** keep the export names of the contracts. A request schema with a
  transform has no output form and stays inline; unused twins are pruned (`prune.ts`).
- `GET /capture/stream` is `text/event-stream`, each `data:` being a `StreamEvent`
  (`components.schemas.StreamEvent`); raw and attachment downloads are `message/rfc822`
  and `*/*`. The payloads Mailsink sends to webhook endpoints are the document's
  `webhooks` (`unified`, `resend`, `brevo`).
- **Left out** (`UNDOCUMENTED_ROUTES`, D232): `/mcp` (described by MCP itself), `POST
  /login` and `/w/$workspaceSlug/…` (web UI session routes). A test of the app
  (`http/openapi-coverage.test.ts`) scans `src/routes` and fails on a server route in
  neither list, on a registry entry no route serves, and on a stale exclusion.
- **Served**: `GET /openapi.json`, public (D231), `servers[0]` = `MAILSINK_PUBLIC_URL`,
  built once, `Access-Control-Allow-Origin: *`, `Cache-Control: public, max-age=300`,
  not written to the request log.
- **File**: `pnpm openapi [file]` writes it (default `openapi.json`, git ignored), meant to
  be attached to each GitHub release (D234). Usage: `docs/guides/api.md`.

## UI search params (`search-params.ts`)

```ts
// Inbox (#39, #40, D177): an invalid value is dropped (`.catch(undefined)`), never an error page;
// `urlText` also reads `?q=2026`, which the router's JSON parsing turns into a number.
export const InboxTab = z.enum(['preview', 'text', 'links', 'headers', 'history'])
export const InboxSearch = z.object({ q: urlText, status: DeliveryStatus.optional(),
  connectionId: ConnectionId.optional(), tag: urlText, m: MessageId.optional(),
  tab: InboxTab.optional() })
// Logs explorer (#41, D190): every key optional, invalid values dropped; multi-value facets
// read an array or comma-separated text. Defaults: tab api, sort -createdAt, page 1, 50 rows.
export const LogsSearch = z.object({ tab: LogsTab.optional(), q: urlText,  // API path, SMTP peer
  connectionId: ConnectionId.optional(), dialect: facet(ApiDialect),
  code: facet(StatusFilter), outcome: facet(SmtpOutcome),            // `404`, `4xx`
  delivery: WebhookDeliveryStatus.optional(), format: PayloadFormat.optional(),
  endpointId: WebhookEndpointId.optional(), sort: ApiLogSort.optional(),
  messageId: MessageId.optional(),                                  // every tab (D213)
  since: IsoDateTime.optional(), until: IsoDateTime.optional(),     // API, SMTP
  method: z.string().optional(), errorCode: z.string().optional(),  // API
  page: z.coerce.number().int().min(1).optional(),                  // every tab
  pageSize: z.coerce.number().int().min(10).max(200).optional(),
  cursor: WebhookDeliveryId.optional(),                // webhooks: keyset of older links
  inspect: z.string().max(80).optional() })                         // row in the sheet
export const PickerSearch = z.object({ ephemeral: z.boolean().default(false) })
/** `/w/$workspaceSlug/connections` (#38): connection id in the panel, or `new`. */
export const ConnectionsSearch = z.object({ connection: z.string().max(64).optional() })
```

## Web UI inbox (#39, #40, propositions D175 to D179)

Code: `apps/mailsink/src/features/{inbox,message-viewer,realtime}`, server functions
`server-fns/messages-fns.ts` and `events-fns.ts` (session checked, workspace by slug, activity
touched), core reads `listInboxRows`, `readInboxFacets`, `readMessagePreviews`
(`core/capture/inbox.ts`, db `repositories/messages-inbox.ts`).

Session routes (D175): the Capture API wants a Bearer key, which an `EventSource`, a download
link or an iframe cannot send, so the inbox reads the same services through routes of the
app authenticated by the UI session cookie (`MAILSINK_UI_AUTH=none`: everyone). The cookie
never authenticates `/capture/**`.

| Route | Answer |
|---|---|
| `GET /w/$workspaceSlug/m/stream` | The `GET /capture/stream` events of the workspace (no filter); `Last-Event-ID` header, or `?lastEventId=` when the inbox reopens the stream itself |
| `GET /w/$workspaceSlug/m/$messageId/raw` | Raw EML, headers of the Capture downloads |
| `GET /w/$workspaceSlug/m/$messageId/attachments/$attachmentId` | The attachment, always `Content-Disposition: attachment` |
| `GET /w/$workspaceSlug/m/$messageId/html?scheme=light\|dark[&remote=blocked]` | The document of the preview iframe (D176), 404 without HTML body; `remote=blocked` narrows its CSP to `style-src 'unsafe-inline'; img-src data:; font-src data:` (D187) |

Without a valid session they answer `401 { error: { code: 'unauthorized' } }`; an unknown
slug, another workspace's message or a missing part `404 not_found`. Each call touches the
workspace activity (D16).

« Payload / Source EML » of the Headers & MIME tab (#106, proposition D209): the server
function `getMessageOriginFn` answers the API log row whose `messageIds` holds the message
(method, path, status, request body as logged, pretty printed) or, for an SMTP message, the
client envelope commands (`EHLO`, `MAIL FROM`, `RCPT TO`) of its SMTP session; `null` when
retention or a purge removed the log. The toggle starts on the payload, as the prototype.

Workspace picker (#104, proposition D206): the server function `listWorkspacesFn({
ephemeral, q?, cursor? })` reads one section at a time (persistent or ephemeral workspaces,
never mixed), newest first, 50 per page with a keyset `nextCursor`; `q` is a
case-insensitive substring of the slug or the name (`%` and `_` taken literally). Each page
carries `ephemeralCount`, an aggregate count of every ephemeral workspace (the switch
caption), so CI leftovers can neither hide persistent workspaces nor cap the count.

Preview (D176): `<iframe sandbox="">` (no allowance: no scripts, opaque origin, no popups,
no forms), document served with `Content-Security-Policy: sandbox; default-src 'none';
style-src 'unsafe-inline' https: http:; img-src data: https: http:; font-src data: https:
http:`, `nosniff`, `no-store`, `Referrer-Policy: no-referrer`. The served HTML gets
`<meta name="color-scheme">` (light or dark mail client background) and `<base
target="_blank">` right after `<head>`; inline `cid:` images become data: URLs (5 MB per
message at most).

Inbox (D177, D178): list of 100-row pages (`listCapturedMessages` plus a 160-character plain
text preview), virtualized; counts over the whole inbox per status, per connection and of the
log rows (API calls, SMTP sessions, webhook deliveries). Search box: `to:` / `from:`
operators, a lone word with `@` searches recipients, anything else is the Capture full text
`q`. One stream per open workspace (the layout) writes into the TanStack Query cache.

Viewer (D179): `?m=` opens a message (the newest one when absent), `?tab=` its tab;
« Simulate » Opened / Clicked / Hard Bounce call `triggerMessageEvent` with origin `ui` and
publish like `POST /capture/messages/:id/events`; « Purge the inbox » deletes every message
of the workspace and keeps the logs (`includeLogs: false`), then publishes `messages.purged`.

## Web UI logs explorer (#41, propositions D190 to D194)

Page `/w/$workspaceSlug/logs` (`LogsSearch`), code in `apps/mailsink/src/features/logs`,
server functions `server-fns/logs-fns.ts` (session checked, workspace by slug, activity
touched) on the services of `GET /capture/logs/api[/:id]`, `GET /capture/logs/smtp[/:id]`,
`GET /capture/webhooks/deliveries[/:id]` and `POST …/:id/replay` (published on the bus).

- Tabs API / SMTP / Webhooks with their counts; columns timestamp, type (dialect, SMTP or
  SMTP TLS, payload format), connection (the endpoint scope for webhooks), action / session /
  event, status, duration (attempts for webhooks). Facets: connection, dialect, status code or
  class (API); connection, outcome (SMTP); status, `payloadFormat`, endpoint (webhooks). The
  search box filters the API path or the SMTP peer. « More filters » (D213): message id
  (every tab), dates (API, SMTP), method and error code (API). Page numbers with the total on
  every tab (webhooks too since D213; a `cursor` of an older link still opens its page).
  Below 768 px the type, connection and duration columns are left out (no sideways scroll),
  and each row has an explicit accessible name (D216).
- `?inspect=` opens the inspector sheet: API request headers (credentials already reduced,
  D146) and bodies, response status, error code, headers (D215) and body;
  SMTP « SMTP dialogue » (AUTH redacted) and the messages it produced; webhooks D192, with the
  replay box D193.
- Live: `log.api`, `log.smtp` and `webhook.delivery` frames of the workspace stream update the
  cache through `applyLogEvent` (D194).

## Web UI auth (#37, propositions D160 to D164)

Sign-in of the web UI by admin key (D13), screens L1a to L1e of brief 2 (B2-1 to B2-3).
Code: `apps/mailsink/src/auth/`.

| Route | Purpose |
|---|---|
| `GET /login?redirect=` | Sign-in screen. `redirect` is kept only when it is a path of the app (not `//host`, a scheme or `/login` itself). Already signed in, or `MAILSINK_UI_AUTH=none`: redirects to `redirect`, else to the last opened workspace, else `/` |
| `POST /login` | Exchanges the admin key for the session cookie |
| `/`, `/w/$workspaceSlug`, `/w/$workspaceSlug/connections` | Signed-in pages: without a valid session, redirect to `/login?redirect=<href>` |

`POST /login` (route server handler, not `defineApi()`, D162):

```ts
// request: application/json, 4 KiB at most
{ key: string }                       // 1 to 1024 characters
// 204: Set-Cookie: mailsink_session=v1.<expires>.<nonce>.<sig>; Path=/; Max-Age=…; HttpOnly; SameSite=Lax[; Secure]
// 401: { error: { code: 'unauthorized', message: 'Invalid admin key' } }
// 429: { error: { code: 'rate_limited', message } } + Retry-After: <seconds>
// 422: { error: { code: 'validation_error', message } }   // body is not { key: string }
// 404: { error: { code: 'not_found', message } }           // MAILSINK_UI_AUTH=none
```

- The answer never reveals how many attempts remain (B2-2). The refused key that reaches
  the threshold already answers `429`; during the pause every call answers `429` with the
  seconds left, the right key included, and the pause is not extended (D161).
- Limiter key: the socket address; with `MAILSINK_TRUST_PROXY=true`, the last
  `X-Forwarded-For` entry, the one the proxy in front of Mailsink appended (D182, D185).
  Threshold and pause:
  `MAILSINK_UI_LOGIN_MAX_ATTEMPTS` (5) failures within `MAILSINK_UI_LOGIN_LOCK_SECONDS` (60),
  then a pause of `MAILSINK_UI_LOGIN_LOCK_SECONDS`.
- Session (D160): signed with `MAILSINK_SESSION_SECRET`, else a secret derived from the admin
  key; valid `MAILSINK_SESSION_TTL` (7 days); a cookie that no longer verifies (expired,
  secret rotated) sends to `/login` with the L1d banner, no cookie at all with none.
- Sign-out: server function `signOut` deletes the cookie of this browser.
- UI server functions (`server-fns/`, D163) answer only with a valid session; opening a
  workspace touches its activity and sets `mailsink_last_workspace` (its slug).

| Variable | Default | Purpose |
|---|---|---|
| `MAILSINK_UI_AUTH` | `admin-key` | `none`: no sign-in at all (local runs, CI) |
| `MAILSINK_SESSION_SECRET` | derived from `MAILSINK_ADMIN_KEY` | Cookie signing, 32 characters at least |
| `MAILSINK_SESSION_TTL` | `604800` (7 days) | Session lifetime: seconds or a duration (`12h`), 60 s to 1 year |
| `MAILSINK_UI_LOGIN_MAX_ATTEMPTS` | `5` | Refused keys before a pause (1 to 1000) |
| `MAILSINK_UI_LOGIN_LOCK_SECONDS` | `60` | Counting window and pause, sent as `Retry-After` (1 to 86400) |
| `MAILSINK_TRUST_PROXY` | `false` | `true`: client address from `X-Forwarded-For` (limiter and request log `ip`) |

## CLI (`mailsink`, #50, propositions D250 to D254)

Package `@devitek/mailsink-cli` (`packages/cli`), bin `mailsink`; guide: `docs/guides/cli.md`.
The piloting commands only call the Admin and Capture APIs through the SDK.

| Command | API call | Credential |
|---|---|---|
| `workspace create [--ephemeral] [--ttl] [--name] [--slug] [--retention] [--connection <kind>[:<name>]]…` | `POST /admin/workspaces` | Admin key |
| `workspace list [--ephemeral]` | `GET /admin/workspaces` (every page) | Admin key |
| `workspace delete <id\|slug>…` | `DELETE /admin/workspaces/:id` | Admin key |
| `wait [filters] [--since] [--timeout] [--link]` | `GET /capture/messages?wait=true`, then the detail | workspace |
| `override set [rates] [--latency] [--error-rate] [--rule]… [--config] [--ttl] [--connection]` | `POST /capture/override` | workspace |
| `override reset [--connection]` | `POST /capture/override/reset` | workspace |
| `purge [--connection] [--before] [--keep-logs]` | `DELETE /capture/messages` | workspace |

- **Settings** (D250): `--url`/`MAILSINK_URL`, `--admin-key`/`MAILSINK_ADMIN_KEY`,
  `--key`/`MAILSINK_KEY`, `--workspace`/`MAILSINK_WORKSPACE`; "workspace" means a `mskw_`
  or `msk_` key, or the Admin key with the workspace id or slug. `--json` prints the API
  answer (`wait` adds `extractedLinks` and `link`, `workspace delete` prints
  `{ deleted: [refs] }`, `workspace list` the array of workspaces).
- **Exit codes** (D252): `0` success, `1` failure, `2` invalid command line, `3` wait
  timeout.
- **Server side** (D251): `migrate` and `mcp` (above) are lazy chunks; `migrate` needs the
  optional peers `drizzle-orm`, `pg` and `@electric-sql/pglite`, present in the image.
