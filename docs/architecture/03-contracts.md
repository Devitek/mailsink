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
| `DELETE /admin/workspaces/:id` | Admin key | admin | Immediate hard delete |
| `POST /v1/emails` · `POST /v1/emails/batch` | `Bearer msk_` (any kind) | native | Native ingestion |
| `POST /emails` · `POST /emails/batch` · `GET /emails/:id` | `Bearer msk_` (resend) | resend | Resend drop-in |
| `POST /v3/smtp/email` | `api-key: msk_` (brevo) | brevo | Brevo drop-in |
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
| `GET|POST /capture/webhooks` · `GET|PATCH|DELETE /capture/webhooks/:id` | workspace scope | capture | Endpoint CRUD |
| `GET /capture/webhooks/deliveries[?endpointId=&payloadFormat=]` · `GET …/:id` | workspace scope | capture | Delivery log |
| `POST /capture/webhooks/deliveries/:id/replay` | workspace scope | capture | Replay (`exact` or `resign`) |
| `POST /capture/webhooks/preview` | workspace scope | capture | Sample payload + headers for a format |
| `POST /capture/webhooks/:id/test` | workspace scope | capture | Send a signed sample event to one endpoint (logged as a delivery) |
| `POST /capture/demo` | workspace scope | capture | Seed the workspace with demo messages through the ingestion pipeline (#62) |
| `GET /capture/stream` | workspace scope | capture | SSE |
| `POST|GET|DELETE /mcp` | workspace scope | mcp | MCP Streamable HTTP |

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
  'soft_bounce', 'hard_bounce', 'complained', 'failed', 'suppressed'])
export const SimulatedStatus = DeliveryStatus.exclude(['queued', 'sent', 'suppressed'])
// Canonical webhook events (D22), see « Webhooks » for the per-format mapping.
export const CanonicalEvent = z.enum(['email.sent', 'email.delivered', 'email.deferred',
  'email.soft_bounced', 'email.hard_bounced', 'email.complained', 'email.opened',
  'email.clicked', 'email.suppressed', 'email.failed'])
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
  `hard_bounce`, `complained` and `failed` take their percentage in that order, the
  remainder goes to `delivered`. A rule `smtpCode` lands in the final event
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
  metadata: z.record(z.string(), z.string().max(256)).optional(),
  connections: z.array(ConnectionInput).max(20).default([]),
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

```ts
export const ResendSendRequest = z.object({
  from: z.string(), to: z.union([z.string(), z.array(z.string()).max(50)]),
  subject: z.string(), bcc: StrOrArr.optional(), cc: StrOrArr.optional(),
  reply_to: StrOrArr.optional(), replyTo: StrOrArr.optional(), // SDK versions differ
  html: z.string().optional(), text: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  attachments: z.array(z.object({ content: z.string().optional(), path: z.url().optional(),
    filename: z.string().optional(), content_type: z.string().optional(),
    content_id: z.string().optional() })).optional(),         // path: stored, not fetched
  tags: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
  scheduled_at: z.string().optional(),                         // stored; delays simulation
})
export const ResendSendResponse = z.object({ id: z.uuid() })    // 200
export const ResendBatchResponse = z.object({ data: z.array(z.object({ id: z.uuid() })) })
export const ResendError = z.object({                           // e.g. 422 validation_error,
  statusCode: z.number(), name: z.string(), message: z.string() }) // 429 rate_limit_exceeded
```

Resend batch is all-or-nothing (provider parity); the native batch is partial.

## Brevo dialect (`brevo.ts`)

```ts
const BrevoAddr = z.object({ email: z.email(), name: z.string().optional() })
export const BrevoSendRequest = z.object({
  sender: BrevoAddr.optional(), to: z.array(BrevoAddr).min(1).optional(),
  cc: z.array(BrevoAddr).optional(), bcc: z.array(BrevoAddr).optional(),
  replyTo: BrevoAddr.optional(), subject: z.string().optional(),
  htmlContent: z.string().optional(), textContent: z.string().optional(),
  templateId: z.number().int().positive().optional(),
  params: z.record(z.string(), z.unknown()).optional(),        // {{ params.x }} injection
  headers: z.record(z.string(), z.string()).optional(),
  attachment: z.array(z.object({ content: z.base64().optional(), url: z.url().optional(),
    name: z.string() })).optional(),
  tags: z.array(z.string()).optional(),
  scheduledAt: z.string().optional(),
  messageVersions: z.array(z.object({ to: z.array(BrevoAddr),
    params: z.record(z.string(), z.unknown()).optional(), subject: z.string().optional(),
    cc: z.array(BrevoAddr).optional(), bcc: z.array(BrevoAddr).optional(),
  })).max(1000).optional(),
}).refine((b) => b.templateId || b.htmlContent || b.textContent, 'content_required')
  .refine((b) => b.templateId || b.sender, 'sender_required')
export const BrevoSendResponse = z.union([
  z.object({ messageId: z.string() }),                         // "<20261122…@smtp-relay.mailin.fr>"
  z.object({ messageIds: z.array(z.string()) }),               // with messageVersions
])                                                             // 201
export const BrevoError = z.object({ code: z.string(), message: z.string() })
```

Unknown `templateId` returns `400 { code: "invalid_parameter" }`. Templates are managed in
the UI or seeded through the Admin API (Phase 3).

## SMTP mapping (`dialects/smtp.ts`)

| Step | Behaviour |
|---|---|
| `AUTH PLAIN/LOGIN` | `smtp_username` -> connection; scrypt verify; fail -> `535 5.7.8` |
| `MAIL FROM` / `RCPT TO` | Suppressed recipient accepted but marked `suppressed` (provider parity) |
| Rate limit | `451 4.7.1 Rate limit exceeded, retry in Ns` |
| Chaos | `421`/`451`/`452`/`550` per active override |
| `DATA` | size cap -> `552`; `mailparser` -> `NormalizedEmail` + raw EML kept as is |
| Reply | `250 2.0.0 Ok: queued as msg_…` |

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
// Phase 3 (webhook delivery issue #33) adds `webhookDeliveries: z.array(WebhookDeliveryView)`.
// Until then the detail already carries `webhookDeliveries: []` (always empty).

export const TriggerEventRequest = z.discriminatedUnion('type', [
  z.object({ type: z.literal('opened'), recipient: z.email().optional(),
    userAgent: z.string().optional() }),
  z.object({ type: z.literal('clicked'), url: z.url(), recipient: z.email().optional(),
    userAgent: z.string().optional() }),
  // Forced simulated status (owner arbitration 22/11, design brand-1, implemented in #34):
  // updates the recipient status (all recipients when omitted), the message aggregate,
  // the suppression list (hard_bounce, complained) and fans out webhooks like a drawn status.
  z.object({ type: z.literal('status'),
    status: z.enum(['delivered', 'deferred', 'soft_bounce', 'hard_bounce', 'complained', 'failed']),
    recipient: z.email().optional(), reason: z.string().max(500).optional() }),
])   // 202 { events, webhookDeliveries: [{ id, endpointId }] }

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
  reason: SuppressionReason, messageId: MessageId.nullable(), createdAt: IsoDateTime })
export const ListSuppressionsResponse = Page(SuppressionView)
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
  workspace; both answer `{ count }`.

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
  `accepted` -> `message.created` (current summary), any other type -> `message.event`.
  Derived frames have no `id:` and are never replayed: the aggregated `message.status`
  (`recipient: null`) after a simulation run, `messages.purged`, `override.changed`,
  `workspace.deleted`.
- Publishers: ingestion after its transaction committed (`message.created`, one
  `message.event` per suppressed recipient; nothing for an idempotent replay); the
  `simulate_delivery` job handler (`sent` and final event per recipient, then the
  aggregated status); `DELETE /capture/messages` (`messages.purged`); the ephemeral GC
  (`workspace.deleted`, then the stream closes).
- `Last-Event-ID` (an `evt_…` id, anything else ignored): the bus subscription is taken
  first and buffered while the replay reads the 500 rows after that id in `(occurred_at,
  id)` order; buffered frames already replayed are dropped. An id the workspace does not
  know replays nothing. A client more than 500 events behind resyncs through
  `GET /capture/messages`.
- Filters: `types` (comma-separated or repeated `StreamEventType`); `connectionId` drops
  message frames of other connections (and of none); `messages.purged`,
  `override.changed` and `workspace.deleted` always pass.
- A client that stops reading while 1 000 frames are queued is disconnected.
- `webhook.delivery`, `log.api` and `log.smtp` join the union with their view contracts
  (#33, #35).

```ts
export const StreamEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('message.created'), message: MessageSummary }),
  z.object({ type: z.literal('message.status'), messageId: z.string(),
    status: DeliveryStatus, recipient: z.string().nullable() }),
  z.object({ type: z.literal('message.event'), event: MessageEventView }),
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
  id: z.string(), connectionId: z.string().nullable(), url: z.string(),
  payloadFormat: PayloadFormat,
  events: z.array(z.string()),            // dialect names of payloadFormat, deduplicated
  canonicalEvents: z.array(CanonicalEvent),
  unsupportedEvents: z.array(CanonicalEvent), // canonical events this format cannot emit
  secretPreview: z.string().nullable(), enabled: z.boolean(),
})
```

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
| `email.failed` | `email.failed` | `email.failed` | not emitted |

Facts behind the non-obvious lines (checked against provider docs on 22/11/2026):
Resend `email.bounced` means a *permanent* rejection and `email.delivery_delayed` a
*temporary* issue, so soft bounces map to `delivery_delayed`; Resend has no per-send
suppression event (`suppression.added` describes the list, not a send). Brevo subscription
names (`hardBounce`, `softBounce`) differ from the payload `event` values (`hard_bounce`,
`soft_bounce`): both directions are mapped. `email.failed` is a canonical addition for the
simulated `failed` status (Resend parity). Owner-approved on 22/11 (D22).

Reverse mapping is many-to-one on purpose: subscribing to Resend
`email.delivery_delayed` stores `email.deferred` + `email.soft_bounced`.

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
    'click', 'deferred', 'blocked']),
  email: z.string(),                                 // the recipient
  id: z.number().int(),                              // webhook id = endpoint numericId
  date: z.string(),                                  // "YYYY-MM-DD HH:mm:ss", workspace tz
  ts: z.number().int(), ts_event: z.number().int(), ts_epoch: z.number().int(),
  'message-id': z.string(),                          // "<…@smtp-relay.mailin.fr>"
  subject: z.string(),
  tag: z.string().optional(),                        // first tag
  tags: z.array(z.string()).optional(),
  template_id: z.number().int().optional(),
  'X-Mailin-custom': z.string().optional(),
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
own body shape (`http/errors.ts`).

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
`POST /v1/emails/batch`, and the provider dialects when they land) set
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
`X-RateLimit-Reset` (seconds), plus `Retry-After` on `429`. The Resend dialect also emits
`ratelimit-limit`/`ratelimit-remaining`/`ratelimit-reset` as Resend does.

## UI search params (`search-params.ts`)

```ts
export const InboxSearch = z.object({ q: z.string().optional(), status: DeliveryStatus.optional(),
  connectionId: z.string().optional(), tag: z.string().optional(), m: z.string().optional() })
export const LogsSearch = z.object({ tab: z.enum(['api', 'smtp', 'webhooks']).default('api'),
  status: z.string().optional(), connectionId: z.string().optional(),
  sort: z.string().default('-createdAt'), page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(10).max(200).default(50), inspect: z.string().optional() })
export const PickerSearch = z.object({ ephemeral: z.boolean().default(false) })
```
