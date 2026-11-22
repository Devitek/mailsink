# 1. Project tree

pnpm monorepo, TypeScript strict, Biome, Vitest, Playwright. One deployable app; logic in
packages so the HTTP routes, the SMTP server, the workers and MCP share one implementation.
Target: files under ~150 lines, one responsibility each.

```
mailsink/
├── apps/
│   └── mailsink/                         # TanStack Start app: UI + every HTTP surface (D1)
│       ├── vite.config.ts                # tanstackStart() + nitro() + react + tailwind
│       ├── nitro.config.ts               # registers runtime/nitro-plugin.ts (D3), copies
│       │                                 # packages/db/migrations into .output/server (D42)
│       ├── src/
│       │   ├── server.ts                 # custom server entry: waits for the runtime (D3)
│       │   ├── router.tsx                # router + QueryClient (SSR dehydrate/hydrate)
│       │   ├── runtime/
│       │   │   ├── nitro-plugin.ts       # boots at process start (exit 1 on failure, D28),
│       │   │   │                         # stops on Nitro `close` (D3)
│       │   │   ├── boot.ts               # idempotent start/stop
│       │   │   ├── restart.ts            # `vite dev`: restarts the runtime when its code changes
│       │   │   │                         # (debounce 500 ms, D3)
│       │   │   ├── slot.ts               # globalThis slot (HMR, two bundles), whenRuntimeReady()
│       │   │   ├── config.ts             # env validated by Zod at boot (D29, « Configuration »)
│       │   │   ├── container.ts          # opens + migrates the db, starts SMTP, the job worker
│       │   │   │                         # and the retention scheduler once; bus and stores later
│       │   │   ├── migrations.ts         # migrations folder of the build (D42)
│       │   │   └── shutdown.ts           # SIGTERM/SIGINT: wait for the srvx HTTP drain and the
│       │   │                             # close hook (SMTP, workers, db), exit 0 (D3)
│       │   ├── http/                     # thin adapters shared by server routes
│       │   │   ├── handler.ts            # defineApi(): request id -> auth -> extensions ->
│       │   │   │                         # parse (Zod) -> handler (D39)
│       │   │   ├── extensions.ts         # ApiExtension hooks: rate limit, activity, request log
│       │   │   ├── auth.ts               # admin key, msk_/mskw_ keys, Brevo api-key header (D41)
│       │   │   ├── errors.ts             # DomainError -> error body (ErrorFormatter per dialect)
│       │   │   ├── validation.ts         # Zod issues -> validation_error details, query, JSON body
│       │   │   ├── body-limit.ts         # request body cap (MAILSINK_MAX_MESSAGE_BYTES)
│       │   │   ├── health.ts             # GET /healthz: liveness + database readiness (D42)
│       │   │   ├── test-fixtures.ts      # test-only: runtime in the slot, seeded keys (rows from
│       │   │   │                         # @mailsink/db/testing)
│       │   │   ├── admin/                # workspaces.ts (Admin API), public-endpoints.ts (URLs
│       │   │   │                         # and SMTP host/port written in credentials)
│       │   │   ├── native/               # emails.ts: POST /v1/emails, /v1/emails/batch
│       │   │   ├── capture/              # api.ts (list, detail, purge), download.ts (raw EML,
│       │   │   │                         # attachments, D60)
│       │   │   ├── rate-limit-headers.ts
│       │   │   ├── sse.ts                # ReadableStream SSE helper (heartbeat, Last-Event-ID)
│       │   │   └── request-log.ts        # api_logs writer (redaction, truncation)
│       │   ├── routes/
│       │   │   ├── __root.tsx
│       │   │   ├── index.tsx                         # workspace picker
│       │   │   ├── login.tsx                         # admin-key login (D13)
│       │   │   ├── w.$workspaceSlug.tsx              # workspace layout (sidebar, SSE)
│       │   │   ├── w.$workspaceSlug.index.tsx        # inbox (virtualized)
│       │   │   ├── w.$workspaceSlug.m.$messageId.tsx # message viewer
│       │   │   ├── w.$workspaceSlug.logs.tsx         # API / SMTP / webhook logs (tabs)
│       │   │   ├── w.$workspaceSlug.suppressions.tsx
│       │   │   ├── w.$workspaceSlug.connections.tsx
│       │   │   ├── w.$workspaceSlug.webhooks.tsx
│       │   │   ├── w.$workspaceSlug.settings.tsx     # defaults, retention, rate limit
│       │   │   ├── admin.workspaces.ts               # POST, GET
│       │   │   ├── admin.workspaces.$id.ts           # GET, DELETE
│       │   │   ├── v1.emails.ts                      # native single send
│       │   │   ├── v1.emails.batch.ts
│       │   │   ├── emails.ts                         # Resend dialect
│       │   │   ├── emails.batch.ts
│       │   │   ├── emails.$id.ts                     # Resend GET /emails/:id
│       │   │   ├── v3.smtp.email.ts                  # Brevo dialect
│       │   │   ├── capture.messages.ts               # GET (wait=true), DELETE
│       │   │   ├── capture.messages.$id.ts
│       │   │   ├── capture.messages.$id.events.ts
│       │   │   ├── capture.messages.$id.attachments.$attId.ts
│       │   │   ├── capture.messages.$id.raw.ts       # message/rfc822 download
│       │   │   ├── capture.override.ts               # GET current, POST activate
│       │   │   ├── capture.override.reset.ts
│       │   │   ├── capture.suppressions.ts           # GET, DELETE (reset)
│       │   │   ├── capture.webhooks.ts                   # GET, POST endpoints
│       │   │   ├── capture.webhooks.$id.ts               # GET, PATCH, DELETE
│       │   │   ├── capture.webhooks.preview.ts           # sample body + headers
│       │   │   ├── capture.webhooks.deliveries.ts        # delivery log
│       │   │   ├── capture.webhooks.deliveries.$id.replay.ts
│       │   │   ├── capture.stream.ts                 # SSE
│       │   │   ├── mcp.ts                            # Streamable HTTP (stateless)
│       │   │   └── healthz.ts
│       │   ├── server-fns/                # createServerFn wrappers for the UI, by feature
│       │   │   ├── workspaces.ts  connections.ts  messages.ts  logs.ts
│       │   │   ├── overrides.ts   webhooks.ts     suppressions.ts
│       │   ├── features/                  # UI, one folder per feature
│       │   │   ├── workspace-picker/      # Base UI Switch "show ephemeral"
│       │   │   ├── inbox/                 # TanStack Virtual list, SSE -> Query cache
│       │   │   ├── message-viewer/        # sandboxed iframe, desktop/mobile, MIME, links
│       │   │   ├── logs/                  # TanStack Table DataTable + Sheet inspector
│       │   │   ├── connections/           # TanStack Form, kind-conditional fields
│       │   │   ├── webhooks/              # scope -> payloadFormat prefill, dialect event
│       │   │   │                          # labels, live payload/headers preview
│       │   │   ├── override/              # rates sum <= 100, latency bounds
│       │   │   └── realtime/              # useWorkspaceStream(): EventSource -> invalidate
│       │   ├── i18n/                      # Lingui (D17, D18)
│       │   │   ├── lingui.ts              # i18n instance, dynamic catalog loading
│       │   │   ├── locales.ts             # supported locales, source locale, cookie name
│       │   │   ├── resolve-locale.ts      # cookie > Accept-Language > en (pure)
│       │   │   ├── locale.server.ts       # reads the request, writes the cookie (D37)
│       │   │   ├── locale-fns.ts          # server functions for loaders and the switcher
│       │   │   └── locale-switcher.tsx
│       │   ├── locales/
│       │   │   ├── en/messages.po         # source locale
│       │   │   └── fr/messages.po
│       │   ├── lib/query-keys.ts
│       │   └── styles/app.css
│       └── tests/e2e/                     # Playwright (UI + SDK drop-in scenarios)
├── packages/
│   ├── contracts/                         # Zod, shared end to end (doc 03)
│   │   └── src/
│   │       ├── common.ts   address.ts   status.ts   ids.ts   errors.ts (ErrorCode, ApiErrorBody)
│   │       ├── admin.ts    native.ts    resend.ts   brevo.ts
│   │       ├── capture.ts  override.ts  webhook.ts  events.ts
│   │       ├── settings.ts              # retention, rate limit, simulation defaults
│   │       └── search-params.ts         # UI search params (filters, tabs)
│   ├── db/                                # Drizzle (doc 02)
│   │   ├── drizzle.config.ts
│   │   ├── migrations/                    # drizzle-kit output (0000_init.sql…)
│   │   ├── test/                          # every DB test runs on PGlite and Postgres:
│   │   │                                  # cascade, constraints, indexes, jobs, journal, migrate…
│   │   └── src/
│   │       ├── schema/  enums.ts workspaces.ts connections.ts keys.ts overrides.ts
│   │       │            messages.ts attachments.ts blobs.ts events.ts suppressions.ts
│   │       │            webhooks.ts webhook-deliveries.ts logs.ts templates.ts
│   │       │            idempotency.ts jobs.ts columns.ts index.ts
│   │       │            json-types.ts            # TranscriptLine only; JSON columns use contracts types
│   │       ├── url.ts                   # DATABASE_URL parsing
│   │       ├── client.ts                # createDb(url): node-postgres | PGlite
│   │       ├── migrate.ts               # migrate(handle), advisory-locked on Postgres
│   │       ├── ids.ts                   # newId(prefix): prefixed UUIDv7, monotonic (D25, D27, D67)
│   │       ├── search-document.ts       # capture full text expression, shared with its GIN index
│   │       ├── testing/                 # @mailsink/db/testing: describeDb() harness, openTestDb(),
│   │       │                            # direct-insert fixtures shared by every package (D68)
│   │       └── repositories/            # one file per aggregate, typed queries only, re-exported
│   │                                        # by name from index.ts (D68): api-keys, blobs,
│   │                                        # connections, idempotency, jobs, messages-read,
│   │                                        # messages-write, messages-status, messages-purge,
│   │                                        # retention, workspaces
│   ├── core/                              # domain services, no HTTP, no React; depends on
│   │   │                                  # @mailsink/contracts, @mailsink/db, drizzle-orm (query
│   │   │                                  # builders in services) and nodemailer (EML composer)
│   │   └── src/
│   │       ├── clock.ts  errors.ts (DomainError, status per code, D40)
│   │       ├── crypto.ts (key hash, constant-time compare; scrypt, hmac later)  # ids: db (D27)
│   │       ├── workspaces/   provision.ts queries.ts views.ts slug.ts activity.ts expiry.ts
│   │       ├── connections/  credentials.ts snippets.ts resolve.ts
│   │       ├── ingestion/    pipeline.ts prepare.ts normalize.ts native.ts compose-eml.ts
│   │       │                 links.ts idempotency.ts testing/fixtures.ts
│   │       ├── dialects/     resend.ts brevo.ts native.ts smtp.ts  # to/from NormalizedEmail
│   │       ├── templates/    render.ts                             # Brevo {{ params.x }}
│   │       ├── simulation/   settings-resolver.ts rules.ts draw.ts latency.ts chaos.ts
│   │       ├── rate-limit/   token-bucket.ts
│   │       ├── suppression/  service.ts
│       │   ├── events/       bus.ts record.ts
│       │   ├── webhooks/     endpoints.ts fanout.ts dispatcher.ts backoff.ts replay.ts
│       │   │   └── formatters/            # Strategy, one per payloadFormat (D20, D21)
│       │   │       types.ts events-map.ts unified.ts resend.ts brevo.ts index.ts
│   │       ├── capture/      service.ts query.ts cursor.ts views.ts wait.ts
│   │       │                 testing/fixtures.ts (@mailsink/core/capture-testing)
│   │       ├── blobs/        store.ts db-store.ts
│   │       ├── simulation/   simulate-delivery.ts planner.ts aggregate.ts testing/fixtures.ts
│   │       ├── retention/    run.ts scheduler.ts (also purges and reports failed jobs, D65)
│   │       └── jobs/         queue.ts worker.ts backoff.ts settings.ts (DEFAULT_JOB_SETTINGS)
│   │                         handlers/{simulate,webhook,expiry}.ts
│   ├── smtp/                              # smtp-server + mailparser adapter
│   │   └── src/ server.ts auth.ts transcript.ts on-data.ts
│   ├── mcp/                               # McpServer factory + tools, transport-agnostic
│   │   └── src/ server.ts tools/{list,get,wait,trigger,override,purge,logs}.ts
│   ├── ui/                                # shadcn/ui on Base UI + tokens (Claude Design later)
│   └── cli/                               # `mailsink` bin: migrate, mcp (stdio proxy, D14)
│                                          # built by tsdown into dist/bin.mjs (+ migrations)
├── docker/
│   ├── Dockerfile                         # multi-stage: deps -> build -> node:24-slim runtime
│   ├── docker-compose.yml                 # mailsink + postgres (PGlite profile without pg,
│   │                                      # named volume pglite-data)
│   └── smoke-test.sh                      # built image: healthy, /healthz 200, SMTP 220, CLI
├── .dockerignore
├── docs/
│   ├── architecture/
│   └── contributing/translations.md       # how to add or fix a locale (D17)
├── .github/ workflows/ci.yml             # lint, typecheck, test (PGlite + Postgres), build, e2e
│            workflows/docker.yml         # image build + docker/smoke-test.sh
│            pull_request_template.md  dependabot.yml  ISSUE_TEMPLATE/translation.yml
├── AGENTS.md  README.md  CONTRIBUTING.md  LICENSE
├── lingui.config.ts                       # locales [en, fr], sourceLocale en, catalogs path
├── biome.json  pnpm-workspace.yaml  tsconfig.base.json
├── tsconfig.json                          # typechecks root files (lingui.config.ts, vitest.config.ts)
```

## Runtime topology (D3)

```
node .output/server/index.mjs
 ├─ HTTP :3000 (Nitro/srvx) ── TanStack Start handler
 │     ├─ SSR UI + server functions
 │     └─ server routes: /admin, /v1, /emails, /v3, /capture, /mcp, /healthz
 ├─ SMTP :1025 (smtp-server)            ─┐
 ├─ job worker (simulate, webhook)       ├─ started by runtime/nitro-plugin.ts at process
 └─ schedulers (retention, ephemeral GC)─┘  start (boot.ts), share container
```

Boot order: config, database and migrations, SMTP listener, worker; any failure exits 1
(D28). Stop order on SIGTERM: HTTP drain (srvx), SMTP, worker, database (D3).

## Configuration (env, validated by Zod at boot)

`src/runtime/config.ts` validates every variable of the first table at boot; the variables of
the second table join the schema with their feature. An invalid value stops the boot with exit
code 1 (D28) and the error names the variable, never its value. Empty values count as unset.

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `pglite://./data` | `postgres://…` or `pglite://<dir>` / `pglite://memory` |
| `MAILSINK_ADMIN_KEY` | unset: Admin key disabled, warning at boot (D41) | Admin API and UI login |
| `PORT` / `MAILSINK_SMTP_PORT` | `3000` / `1025` | Listeners (`PORT` is read by Nitro) |
| `MAILSINK_SMTP_HOST` | `0.0.0.0` | SMTP bind address |
| `MAILSINK_SMTP_PUBLIC_HOST` | hostname of `MAILSINK_PUBLIC_URL` | SMTP host written in credentials and `.env` snippets (D66) |
| `MAILSINK_SMTP_PUBLIC_PORT` | port the SMTP listener is bound to | SMTP port written in credentials, e.g. behind a Docker port mapping (D66) |
| `MAILSINK_PUBLIC_URL` | `http://localhost:3000` | Base of links, snippets and MCP URLs (D35), trailing slash dropped |
| `MAILSINK_DEFAULT_IDLE_TTL` | `3600` | Idle TTL of ephemeral workspaces created without one: seconds or a duration (`15m`), within the contract bounds |
| `MAILSINK_MAX_MESSAGE_BYTES` | `26214400` | Ingestion cap (25 MB): request bodies and composed messages |
| `MAILSINK_RETENTION_INTERVAL_SECONDS` | `60` | Period of the retention pass (1 to 86400, D49) |
| `MAILSINK_JOBS_POLL_INTERVAL_MS` | `1000` | Job worker polling period (10 to 60000) |
| `MAILSINK_JOBS_BATCH_SIZE` | `20` | Jobs claimed per poll (1 to 1000) |
| `MAILSINK_JOBS_LOCK_SECONDS` | `30` | Lease of a claimed job (1 to 86400) |
| `MAILSINK_JOBS_MAX_ATTEMPTS` | `5` | Attempts before a job is given up on (1 to 100, D47) |
| `MAILSINK_JOBS_BACKOFF_BASE_SECONDS` / `_MAX_SECONDS` | `5` / `900` | Retry delay, doubled per attempt and capped (D47); the cap may not be below the base |
| `MAILSINK_JOBS_FAILED_RETENTION_SECONDS` | `604800` (7 days) | How long a failed job stays for diagnosis before the retention pass purges it (60 to 31536000, D65) |

Planned, not read yet:

| Variable | Default | Purpose |
|---|---|---|
| `MAILSINK_SMTP_TLS_CERT` / `_KEY` | unset | Optional STARTTLS |
| `MAILSINK_UI_AUTH` | `admin-key` | `none` for local/CI |
| `MAILSINK_SESSION_SECRET` | derived from admin key | Cookie signing |
