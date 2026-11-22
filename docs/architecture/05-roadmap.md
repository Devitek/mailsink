# 5. Incremental roadmap

Each phase is a GitHub epic; each line below is an issue (a sub-issue of the epic). Every
phase ends with something usable and tested. The UI design comes from Claude Design during
Phase 4; earlier phases only ship a functional shell.

## Phase 1: Core DB and ingestion

Goal: a single Docker container that accepts `POST /v1/emails`, stores it, and lets a test
read it back with `GET /capture/messages`.

1. Monorepo scaffold: pnpm workspaces, TypeScript strict, Biome, Vitest, CI, Dependabot.
2. Spike: TanStack Start runtime boot (custom server entry starting SMTP + workers in dev
   and in the Nitro build, clean shutdown) (D3).
3. Lingui setup: FR + EN catalogs, locale detection, CI check, translation guide (D17-D19).
4. `@mailsink/db`: schema (doc 02), migrations, `node-postgres` + PGlite drivers,
   test harness running every DB test on both drivers.
5. `@mailsink/contracts`: primitives, admin, native, capture schemas.
6. Admin API: create/list/get/delete persistent workspaces, connection keys (`msk_`,
   `mskw_`), env snippets.
7. Native ingestion: `/v1/emails`, `/v1/emails/batch`, `NormalizedEmail`, EML composition,
   link extraction, blob store, `Idempotency-Key`.
8. Capture API v1: list/filter/detail/raw/attachments/purge.
9. Jobs queue + simulation baseline (`delivered` 100 %, status events).
10. Retention scheduler (duration + `maxMessages`, orphan blobs).
11. Docker multi-stage image + `docker-compose.yml` (Postgres and PGlite profiles).

## Phase 2: Ephemeral workspaces and overrides

Goal: parallel CI workers each get an isolated, self-destroying workspace with chaos knobs.

1. Ephemeral workspaces: `ephemeral`, `idleTtlSeconds`, `includeEphemeral` filter.
2. Activity tracking (throttled touch on every surface) + ephemeral GC scheduler.
3. Settings resolver (4 layers) and simulation engine: weighted rates, deterministic
   recipient rules, latency, deferred re-queue.
4. Override API: `GET/POST /capture/override`, `/reset`, optional TTL, history.
5. Suppression list: auto-add on `hard_bounce`/`complained`, `suppressed` at ingestion,
   list/reset API.
6. Rate limiting: token bucket, workspace/connection/override layers, headers, `429`.
7. Chaos: request-level error rate (HTTP codes).
8. Event bus + `GET /capture/stream` (SSE, `Last-Event-ID`) + `wait=true` long-poll.
9. E2E recipe docs: Playwright fixture creating one workspace per worker.

## Phase 3: Provider dialects and webhooks

Goal: point the official Resend, Brevo and Nodemailer clients at Mailsink with only a base
URL / host change.

1. Resend dialect: `POST /emails`, `/emails/batch`, `GET /emails/:id`, error shapes,
   `ratelimit-*` headers; contract tests with the official `resend` SDK.
2. Brevo dialect: `POST /v3/smtp/email`, `messageVersions`, templates + `{{ params.x }}`
   rendering, error shapes; contract tests with `@getbrevo/brevo`.
3. Brevo templates management (Admin API + seed).
4. SMTP server: `smtp-server` + `mailparser`, AUTH PLAIN/LOGIN, STARTTLS option, size cap,
   SMTP chaos and rate limit codes, transcripts; contract tests with `nodemailer`.
5. Webhook endpoints CRUD: workspace or connection scope, `payloadFormat` defaulted from
   the connection kind, canonical events mapped both ways per format, preview endpoint.
6. Webhook dispatcher: `WebhookFormatter` strategy (unified, Resend, Brevo), decoupled
   from the ingestion channel; X-Mailsink HMAC, Svix and Brevo auth headers; exact body
   stored once; backoff retries; attempts journal with exact headers; replay
   (`exact` / `resign`).
7. Manual events: `POST /capture/messages/:id/events` (opened, clicked + url, forced
   simulated status), auto open/click rates; webhook test send.
8. Request logging: `api_logs` (redaction, truncation), `smtp_sessions`, log query API.

## Phase 4: Web UI and MCP

Goal: staging teams inspect everything in the browser; AI agents drive tests through MCP.

1. Integration of the Claude Design delivery `docs/design/brand-1` into `@mailsink/ui`
   (tokens, fonts, theme, logos; shadcn/ui on Base UI); brief 2 for the login screen and
   the language switcher.
2. App shell: admin-key login / `MAILSINK_UI_AUTH=none`, workspace picker with ephemeral
   toggle, locale switcher, direct `/w/$workspaceSlug` access.
3. Workspace and connection management (TanStack Form, kind-conditional fields,
   credentials shown once, rotation, `.env` snippets).
4. Inbox: SSE -> Query cache, TanStack Virtual list, URL-persisted filters.
5. Message viewer: sandboxed HTML preview (desktop/mobile), text, MIME source, headers,
   attachments, links with click simulation, status/webhook timeline.
6. Logs: DataTables (API / SMTP / webhooks), faceted filters, server pagination,
   inspector `Sheet` (webhooks: `payloadFormat`, exact signature headers, exact body),
   webhook replay (optimistic, `exact` / `resign`).
7. Override panel (rates sum <= 100, latency bounds, reset) and suppression list UI.
8. Settings: defaults, retention, rate limits, webhooks (scope prefills
   `payloadFormat`, event labels follow the format, live payload and headers preview).
9. MCP server: tools (`list_emails`, `get_email`, `wait_for_email`,
   `trigger_email_event`, `set_override_config`, `reset_override_config`,
   `purge_emails`, `get_delivery_logs`), Streamable HTTP at `/mcp`, stdio proxy CLI.
10. Release: README, docs site pages, image publication (GHCR), v0.1.0.

## Cross-cutting rules

- Every DB-dependent test runs on Postgres and PGlite.
- Every dialect has contract tests driven by the official SDK.
- No UI string outside Lingui; FR and EN catalogs complete in CI.
