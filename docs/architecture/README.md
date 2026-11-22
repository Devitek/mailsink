# Mailsink architecture

Mailsink captures and emulates transactional email. It never delivers to the outside world.
Two usages share one engine:

- **E2E / CI**: ephemeral workspaces provisioned per test worker through the Admin API,
  idle TTL, chaos overrides, assertions through the Capture API or MCP.
- **Staging / QA**: persistent workspaces with drop-in Resend, Brevo and SMTP endpoints,
  plus a web UI to inspect rendered emails, SMTP transcripts, API calls and webhooks.

## Documents

1. [Project tree](01-project-tree.md)
2. [Database schema (Drizzle)](02-database-schema.md)
3. [Contracts and critical routes (Zod)](03-contracts.md)
4. [End-to-end sequence](04-sequence.md)
5. [Incremental roadmap](05-roadmap.md)

## Key architecture decisions

Decisions marked *(owner)* were taken by the product owner. Decisions marked *(proposal)*
are the architect's defaults and stay open to veto; each one is tracked in an issue.

| # | Decision | Status |
|---|---|---|
| D1 | **Every HTTP surface lives inside the TanStack Start app** (server routes): Admin, native `/v1`, Resend, Brevo, Capture, SSE, MCP. No separate Fastify/Elysia server. | owner |
| D2 | Issues/PRs/commits in French; code, README and docs in English. Public repo, MIT. | owner |
| D3 | **One Node process**: the custom server entry (`src/server.ts`) boots an idempotent runtime (migrations, SMTP listener, workers) next to the HTTP handler. Single-instance by design; horizontal scaling is out of scope for v1. | proposal |
| D4 | Domain logic lives in framework-agnostic packages (`core`, `db`, `contracts`); server routes and server functions are thin adapters. The SMTP server and MCP call the same services. | proposal |
| D5 | **Postgres-backed job queue** (`jobs` table, `FOR UPDATE SKIP LOCKED`) for delivery simulation and webhook retries. Works identically on Postgres and PGlite, survives restarts, no Redis. | proposal |
| D6 | **In-process event bus** feeds SSE, `wait=true` long-polling and MCP `wait_for_email`. Postgres `LISTEN/NOTIFY` bridge kept as a later option. | proposal |
| D7 | Rate limiter: in-memory token bucket per connection (single instance, D3). Headers follow the IETF draft names already used by providers. | proposal |
| D8 | Binary data (attachments, raw EML) in a content-addressed `blobs` table (`bytea`), behind a `BlobStore` interface so a filesystem/S3 driver can follow. | proposal |
| D9 | Every message gets a raw EML: parsed from SMTP, composed with Nodemailer `MailComposer` for API ingestion. The UI and `GET /messages/:id` always have a MIME source. | proposal |
| D10 | Per-recipient status (`message_recipients`), aggregated on the message. Matches Brevo semantics, makes suppression and deterministic rules exact. | proposal |
| D11 | Credentials: `msk_` keys stored as SHA-256 (high entropy, no slow hash needed); SMTP passwords stored with scrypt and an in-memory verified-credential cache. Webhook secrets (`whsec_`) stored in clear because they sign payloads. | proposal |
| D12 | Capture/MCP auth: any active key of the workspace (connection key `msk_` or workspace key `mskw_`). The Admin key may act on any workspace with `X-Mailsink-Workspace`. Workspace keys exist so SMTP-only workspaces can use Capture/MCP. | proposal |
| D13 | Web UI auth: admin-key login exchanged for a signed, http-only session cookie. `MAILSINK_UI_AUTH=none` for local/CI. | proposal |
| D14 | MCP over stdio is a thin CLI (`mailsink mcp`) that proxies to the HTTP MCP endpoint, so stdio never needs DB access. | proposal |
| D15 | Literal `/_admin` and `/_capture` URLs: TanStack Router treats a leading `_` as a pathless layout. Files use the escaped segment `[_]admin`; fallback if the spike fails: a prefix dispatcher in `src/server.ts`. Validated in the Phase 1 spike. | proposal |
| D16 | Activity tracking (`last_activity_at`) is throttled in memory (one write per workspace every 15 s at most) to avoid write amplification under load. | proposal |
| D17 | **i18n with Lingui** (`@lingui/react` + macros, Vite plugin, PO catalogs). FR and EN shipped from day one; every user-facing UI string goes through Lingui. Translation PRs follow `docs/contributing/translations.md`. | owner |
| D18 | Lingui source locale is English (code and docs are English); FR is a full catalog. UI locale: user choice (cookie) > `Accept-Language` > `en`. CI fails on missing FR/EN translations (`lingui extract` + `compile --strict`). | proposal |
| D19 | API, SMTP and MCP responses are not translated (stable machine-readable codes and English messages, like the providers they emulate). Only the web UI is localized. | proposal |
| D20 | **Ingestion channel and outgoing webhook format are strictly decoupled.** Each endpoint has a scope (`connectionId` or `null` = Workspace) and a `payloadFormat` (`unified`, `resend`, `brevo`), defaulted to the connection kind for resend/brevo, `unified` for smtp or Workspace scope, always explicitly settable. The UI form prefills the format from the scope, adapts event labels and previews payload and signature headers; the delivery log shows the format, the exact headers and body. | owner |
| D21 | Formatters live in `packages/core/src/webhooks/formatters/` (not `src/server/…` inside the app) to keep D4: the dispatcher, the replay and the MCP all share them. | proposal |
| D22 | Events stored canonical only, mapped both ways per format (table in 03-contracts). Proposals inside: `email.failed` added as canonical; Resend maps soft bounces to `email.delivery_delayed` and emits nothing for `email.suppressed`; Brevo emits nothing for `email.failed`; on a format change, unrepresentable events are kept but reported as `unsupportedEvents`. | owner (canonical list) + proposal (details) |
| D23 | Brevo webhooks are not signed (as Brevo): bearer token, basic auth and custom headers only; no `X-Sib-Signature`. Brevo `date` uses the workspace `timezone` (default UTC); `id` is a numeric endpoint id. | proposal |
| D24 | Body serialized once and stored; every attempt re-signs it with its own timestamp (Svix behaviour). Replay keeps the body bytes; mode `exact` (owner request, default) also copies the headers and signature, mode `resign` refreshes timestamp and signature. Unified signature covers `"<timestamp>.<body>"`. | owner (exact replay) + proposal (retries, `resign`, signed string) |
| D25 | Identifiers stay prefixed text (`con_…`, UUIDv7 body) rather than raw `uuid`, including `connectionId` on endpoints. | proposal |
