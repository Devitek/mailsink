# 3. Contracts and critical routes (Zod)

All schemas live in `@mailsink/contracts` (Zod 4) and are imported by the DB layer
(`$type<>` via `z.infer`), server routes, server functions, TanStack Form, router search
params and MCP tool definitions. Provider dialect schemas mirror the public provider
contracts and are tested against the official SDKs (`resend`, `@getbrevo/brevo`,
`nodemailer`) in Phase 3.

## Route map

| Route | Auth | Dialect | Purpose |
|---|---|---|---|
| `POST /_admin/workspaces` | Admin key | admin | Create workspace (+ connections) |
| `GET /_admin/workspaces?includeEphemeral=` | Admin key | admin | List |
| `GET /_admin/workspaces/:id` | Admin key | admin | Detail |
| `DELETE /_admin/workspaces/:id` | Admin key | admin | Immediate hard delete |
| `POST /v1/emails` · `POST /v1/emails/batch` | `Bearer msk_` (any kind) | native | Native ingestion |
| `POST /emails` · `POST /emails/batch` · `GET /emails/:id` | `Bearer msk_` (resend) | resend | Resend drop-in |
| `POST /v3/smtp/email` | `api-key: msk_` (brevo) | brevo | Brevo drop-in |
| SMTP `:1025` | `AUTH PLAIN/LOGIN` (smtp) | smtp | Nodemailer / any client |
| `GET /_capture/messages` | workspace scope (D12) | capture | Search, `wait=true` |
| `GET /_capture/messages/:id` | workspace scope | capture | Full detail |
| `GET /_capture/messages/:id/raw` | workspace scope | capture | `message/rfc822` |
| `GET /_capture/messages/:id/attachments/:attId` | workspace scope | capture | Binary |
| `POST /_capture/messages/:id/events` | workspace scope | capture | Force opened/clicked |
| `DELETE /_capture/messages` | workspace scope | capture | Purge messages and logs |
| `GET /_capture/override` · `POST /_capture/override` | workspace scope | capture | Read / activate |
| `POST /_capture/override/reset` | workspace scope | capture | Back to defaults |
| `GET /_capture/suppressions` · `DELETE /_capture/suppressions[?email=]` | workspace scope | capture | List / reset |
| `GET|POST /_capture/webhooks` · `GET|PATCH|DELETE /_capture/webhooks/:id` | workspace scope | capture | Endpoint CRUD |
| `GET /_capture/webhooks/deliveries[?endpointId=&payloadFormat=]` · `GET …/:id` | workspace scope | capture | Delivery log |
| `POST /_capture/webhooks/deliveries/:id/replay` | workspace scope | capture | Replay (`exact` or `resign`) |
| `POST /_capture/webhooks/preview` | workspace scope | capture | Sample payload + headers for a format |
| `GET /_capture/stream` | workspace scope | capture | SSE |
| `POST|GET|DELETE /mcp` | workspace scope | mcp | MCP Streamable HTTP |

Workspace scope = `Authorization: Bearer msk_…|mskw_…`, or Admin key +
`X-Mailsink-Workspace: <id|slug>`. Every authenticated call touches workspace activity.

## Shared primitives (`common.ts`, `address.ts`, `status.ts`)

```ts
import { z } from 'zod'

export const Email = z.email().transform((e) => e.toLowerCase())
/** "Jane <jane@x.io>" | "jane@x.io" | { email, name } -> { email, name? } */
export const Address = z.union([z.string(), z.object({ email: Email, name: z.string().optional() })])
  .transform(parseAddress)                                    // throws ZodIssue on bad input
export const AddressList = z.union([Address, z.array(Address)])
  .transform((v) => (Array.isArray(v) ? v : [v]))
export const Slug = z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/)
export const Duration = z.union([
  z.number().int().positive(),                                // seconds
  z.string().regex(/^\d+(s|m|h|d)$/).transform(toSeconds),    // "1h", "7d"
])

export const DeliveryStatus = z.enum(['queued', 'sent', 'delivered', 'deferred',
  'soft_bounce', 'hard_bounce', 'complained', 'failed', 'suppressed'])
export const SimulatedStatus = DeliveryStatus.exclude(['queued', 'sent', 'suppressed'])
// Canonical webhook events (D22), see « Webhooks » for the per-format mapping.
export const CanonicalEvent = z.enum(['email.sent', 'email.delivered', 'email.deferred',
  'email.soft_bounced', 'email.hard_bounced', 'email.complained', 'email.opened',
  'email.clicked', 'email.suppressed', 'email.failed'])
```

## Settings and override (`settings.ts`, `override.ts`)

```ts
export const StatusRates = z.partialRecord(SimulatedStatus, z.number().min(0).max(100))
  .refine((r) => Object.values(r).reduce((a, b) => a + (b ?? 0), 0) <= 100,
    { message: 'rates_sum_exceeds_100' })                    // remainder -> delivered

export const RecipientRule = z.object({
  match: z.string().min(1),                                   // glob: "*+bounce@*"
  status: SimulatedStatus.optional(),
  delayMs: z.number().int().min(0).max(600_000).optional(),
  smtpCode: z.number().int().min(400).max(599).optional(),
}).refine((r) => r.status || r.delayMs !== undefined, 'rule_needs_effect')

export const Latency = z.object({
  minMs: z.number().int().min(0).max(600_000),
  maxMs: z.number().int().min(0).max(600_000),
}).refine((l) => l.minMs <= l.maxMs, { message: 'latency_min_gt_max', path: ['maxMs'] })

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

export const SimulationSettings = z.object({
  rates: StatusRates.default({ delivered: 100 }),
  rules: z.array(RecipientRule).max(50).default([]),
  latency: Latency.default({ minMs: 0, maxMs: 0 }),           // queued -> final status
  openRate: z.number().min(0).max(100).default(0),            // auto opened/clicked events
  clickRate: z.number().min(0).max(100).default(0),
})

export const OverrideConfig = z.object({
  rates: StatusRates.optional(),
  rules: z.array(RecipientRule).max(50).optional(),
  latency: Latency.optional(),
  chaos: Chaos.optional(),
  rateLimit: RateLimitSettings.optional(),
}).refine((c) => Object.keys(c).length > 0, 'override_empty')

export const ActivateOverrideRequest = z.object({
  connectionId: z.string().startsWith('con_').optional(),     // omitted = workspace-wide
  config: OverrideConfig,
  ttl: Duration.optional(),                                   // auto-reset after
})
export const ResetOverrideRequest = z.object({ connectionId: z.string().optional() })
export const OverrideState = z.object({
  workspace: OverrideView.nullable(),
  connections: z.array(OverrideView),
  effective: z.record(z.string(), SimulationSettings),        // per connection, resolved
})
```

## Admin (`admin.ts`)

```ts
export const ConnectionInput = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('resend'), name: z.string().min(1).max(80) }),
  z.object({ kind: z.literal('brevo'), name: z.string().min(1).max(80) }),
  z.object({ kind: z.literal('smtp'), name: z.string().min(1).max(80),
    smtpUsername: z.string().regex(/^[a-zA-Z0-9._-]{3,64}$/).optional() }), // generated if absent
]).and(z.object({
  retention: Duration.optional(),
  rateLimit: RateLimitSettings.nullable().optional(),
  simulation: SimulationSettings.partial().optional(),
}))

export const CreateWorkspaceRequest = z.object({
  name: z.string().min(1).max(80),
  slug: Slug.optional(),                                      // generated: name + suffix
  ephemeral: z.boolean().default(false),
  idleTtlSeconds: z.number().int().min(60).max(30 * 86_400).optional(),
  retention: Duration.default('7d'),
  maxMessages: z.number().int().positive().optional(),
  rateLimit: RateLimitSettings.nullable().optional(),
  simulation: SimulationSettings.optional(),
  metadata: z.record(z.string(), z.string().max(256)).optional(),
  connections: z.array(ConnectionInput).max(20).default([]),
}).transform((w) => ({ ...w,
  idleTtlSeconds: w.ephemeral ? (w.idleTtlSeconds ?? env.defaultIdleTtl) : undefined }))

export const ConnectionCredentials = z.discriminatedUnion('kind', [
  z.object({ kind: z.enum(['resend', 'brevo']), apiKey: z.string().startsWith('msk_') }),
  z.object({ kind: z.literal('smtp'), smtpHost: z.string(), smtpPort: z.number(),
    smtpUser: z.string(), smtpPass: z.string() }),
])

export const CreateWorkspaceResponse = z.object({   // 201, secrets shown once
  workspace: WorkspaceView,                         // id, slug, ephemeral, expiresAt, urls
  workspaceKey: z.string().startsWith('mskw_'),     // capture + MCP (D12)
  connections: z.array(ConnectionView.extend({ credentials: ConnectionCredentials,
    envSnippet: z.string() })),                     // RESEND_API_KEY=… RESEND_BASE_URL=…
})

export const ListWorkspacesQuery = z.object({
  includeEphemeral: z.stringbool().default(false),
  cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(200).default(50),
})
```

## Native ingestion (`native.ts`)

```ts
export const AttachmentInput = z.object({
  filename: z.string().max(255),
  content: z.base64(),
  contentType: z.string().optional(),               // sniffed from filename otherwise
  contentId: z.string().optional(),                 // inline cid
})

export const SendEmailRequest = z.object({
  from: Address, to: AddressList, cc: AddressList.optional(), bcc: AddressList.optional(),
  reply_to: AddressList.optional(),
  subject: z.string().max(998),
  html: z.string().optional(), text: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  tags: z.array(z.object({ name: z.string().regex(/^[\w-]{1,256}$/), value: z.string() }))
    .max(50).optional(),
  attachments: z.array(AttachmentInput).max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).refine((e) => e.html || e.text, 'html_or_text_required')
  .refine((e) => e.to.length + (e.cc?.length ?? 0) + (e.bcc?.length ?? 0) <= 50,
    'too_many_recipients')

export const SendEmailResponse = z.object({ id: z.string(), status: DeliveryStatus })
export const BatchRequest = z.array(SendEmailRequest).min(1).max(100)
export const BatchResponse = z.object({              // 207 when partial, 200 when all ok
  data: z.array(z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), index: z.number(), id: z.string() }),
    z.object({ ok: z.literal(false), index: z.number(), error: ApiError }),
  ])),
})
// Header: Idempotency-Key (<= 256 chars, 24 h). Same key + different body -> 409.
```

Every dialect maps to one internal type, `NormalizedEmail` (`core/ingestion/normalize.ts`),
the only input of the ingestion pipeline.

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
  status: z.union([DeliveryStatus, z.array(DeliveryStatus)]).optional(),
  connectionId: z.string().optional(),
  since: z.iso.datetime().optional(), until: z.iso.datetime().optional(),
  q: z.string().optional(),                                    // full text (subject, body)
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
  wait: z.stringbool().default(false),
  timeout: z.coerce.number().int().min(0).max(30_000).default(5_000),
})
// wait=true: returns as soon as >= 1 message matches (created after the request when
// `since` is absent), else 408 { error: "wait_timeout" } after `timeout` ms.

export const MessageSummary = z.object({ id: z.string(), connectionId: z.string().nullable(),
  source: z.enum(['native', 'resend', 'brevo', 'smtp']), from: AddressOut,
  to: z.array(AddressOut), subject: z.string(), status: DeliveryStatus,
  tags: z.array(Tag), hasAttachments: z.boolean(), createdAt: z.iso.datetime() })

export const MessageDetail = MessageSummary.extend({
  cc: z.array(AddressOut), bcc: z.array(AddressOut), replyTo: z.array(AddressOut),
  html: z.string().nullable(), text: z.string().nullable(),
  headers: z.record(z.string(), z.string()), metadata: z.record(z.string(), z.unknown()),
  links: z.array(z.object({ url: z.string(), text: z.string().optional() })),
  attachments: z.array(z.object({ id: z.string(), filename: z.string().nullable(),
    contentType: z.string(), sizeBytes: z.number(), inline: z.boolean(),
    downloadUrl: z.string() })),
  recipients: z.array(z.object({ email: z.string(), kind: z.enum(['to', 'cc', 'bcc']),
    status: DeliveryStatus, reason: z.string().nullable() })),
  events: z.array(MessageEventView),
  webhookDeliveries: z.array(WebhookDeliveryView),
  rawUrl: z.string(), simulation: z.record(z.string(), z.unknown()).nullable(),
})

export const TriggerEventRequest = z.discriminatedUnion('type', [
  z.object({ type: z.literal('opened'), recipient: z.email().optional(),
    userAgent: z.string().optional() }),
  z.object({ type: z.literal('clicked'), url: z.url(), recipient: z.email().optional(),
    userAgent: z.string().optional() }),
])   // 202 { event, webhookDeliveries: [{ id, endpointId }] }

export const PurgeQuery = z.object({ connectionId: z.string().optional(),
  before: z.iso.datetime().optional(), includeLogs: z.stringbool().default(true) })
```

## Stream (`GET /_capture/stream`)

`text/event-stream`, heartbeat comment every 15 s, `id:` = event id, `Last-Event-ID`
replays from `message_events` (bounded to 500). Query: `connectionId?`, `types?`.

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
])
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
UI warns before saving (proposal, D22).

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
simulated `failed` status (Resend parity). All four lines are proposals (D22).

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
(proposal, D24).

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
adding a non-standard signature would make Mailsink less faithful (proposal, D23, to
confirm or veto).

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
- `resign` (proposal): same body and same delivery id header, fresh timestamp and
  signature, as the Svix dashboard « resend » does; the receiver accepts it.

`POST /_capture/webhooks/preview` takes `{ payloadFormat, event, connectionId? }` and
returns `{ body, headers }` built by the real formatter from a sample message, with the
endpoint secret masked. The UI form uses it for the live preview.

## Errors and rate limit headers

Native/capture/admin error body: `{ error: { code, message, details? }, requestId }`.
Codes: `unauthorized`, `forbidden`, `validation_error`, `not_found`, `conflict`,
`idempotency_mismatch`, `rate_limited`, `payload_too_large`, `chaos_injected`,
`wait_timeout`. Resend/Brevo dialects map these to their own body shape (`http/errors.ts`).

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
