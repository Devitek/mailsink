# 1. Project tree

pnpm monorepo, TypeScript strict, Biome, Vitest, Playwright. One deployable app; logic in
packages so the HTTP routes, the SMTP server, the workers and MCP share one implementation.
Target: files under ~150 lines, one responsibility each.

```
mailsink/
├── apps/
│   └── mailsink/                         # TanStack Start app: UI + every HTTP surface (D1)
│       ├── vite.config.ts                # tanstackStart() + nitro() + react + tailwind
│       ├── nitro.config.ts               # registers runtime/nitro-plugin.ts (D3)
│       ├── src/
│       │   ├── server.ts                 # custom server entry: waits for runtime, request id (D3)
│       │   ├── router.tsx                # router + QueryClient (SSR dehydrate/hydrate)
│       │   ├── runtime/
│       │   │   ├── nitro-plugin.ts       # boots at process start, stops on Nitro `close` (D3)
│       │   │   ├── boot.ts               # idempotent start/stop
│       │   │   ├── slot.ts               # globalThis slot (HMR, two bundles), whenRuntimeReady()
│       │   │   ├── config.ts             # runtime env (until the Zod config lands)
│       │   │   ├── container.ts          # builds db, services, bus, stores once
│       │   │   └── shutdown.ts           # SIGTERM/SIGINT: stop SMTP, drain workers, close db
│       │   ├── http/                     # thin adapters shared by server routes
│       │   │   ├── handler.ts            # defineApi(): parse -> auth -> rate limit -> log
│       │   │   ├── auth.ts               # admin key, msk_/mskw_ keys, Brevo api-key header
│       │   │   ├── errors.ts             # DomainError -> per-dialect error body
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
│       │   │   ├── locale.server.ts       # cookie > Accept-Language > en, SSR activation
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
│   │       ├── common.ts   address.ts   status.ts   ids.ts
│   │       ├── admin.ts    native.ts    resend.ts   brevo.ts
│   │       ├── capture.ts  override.ts  webhook.ts  events.ts
│   │       ├── settings.ts              # retention, rate limit, simulation defaults
│   │       └── search-params.ts         # UI search params (filters, tabs)
│   ├── db/                                # Drizzle (doc 02)
│   │   ├── drizzle.config.ts
│   │   ├── migrations/                    # drizzle-kit output (0000_init.sql…)
│   │   ├── test/                          # every DB test runs on PGlite and Postgres
│   │   └── src/
│   │       ├── schema/  enums.ts workspaces.ts connections.ts keys.ts overrides.ts
│   │       │            messages.ts attachments.ts blobs.ts events.ts suppressions.ts
│   │       │            webhooks.ts webhook-deliveries.ts logs.ts templates.ts
│   │       │            idempotency.ts jobs.ts columns.ts json-types.ts index.ts
│   │       ├── url.ts                   # DATABASE_URL parsing
│   │       ├── client.ts                # createDb(url): node-postgres | PGlite
│   │       ├── migrate.ts               # migrate(handle), advisory-locked on Postgres
│   │       ├── ids.ts                   # newId(prefix): prefixed UUIDv7 (D25, D27)
│   │       ├── testing/                 # describeDb() harness (@mailsink/db/testing)
│   │       └── repositories/            # one file per aggregate, typed queries only
│   ├── core/                              # domain services, no HTTP, no React
│   │   └── src/
│   │       ├── clock.ts  errors.ts  crypto.ts (keys, scrypt, hmac)   # ids: db (D27)
│   │       ├── workspaces/   provision.ts activity.ts expiry.ts
│   │       ├── connections/  credentials.ts resolve.ts
│   │       ├── ingestion/    pipeline.ts normalize.ts compose-eml.ts links.ts idempotency.ts
│   │       ├── dialects/     resend.ts brevo.ts native.ts smtp.ts  # to/from NormalizedEmail
│   │       ├── templates/    render.ts                             # Brevo {{ params.x }}
│   │       ├── simulation/   settings-resolver.ts rules.ts draw.ts latency.ts chaos.ts
│   │       ├── rate-limit/   token-bucket.ts
│   │       ├── suppression/  service.ts
│       │   ├── events/       bus.ts record.ts
│       │   ├── webhooks/     endpoints.ts fanout.ts dispatcher.ts backoff.ts replay.ts
│       │   │   └── formatters/            # Strategy, one per payloadFormat (D20, D21)
│       │   │       types.ts events-map.ts unified.ts resend.ts brevo.ts index.ts
│   │       ├── capture/      query.ts wait.ts purge.ts
│   │       ├── blobs/        store.ts db-store.ts
│   │       └── jobs/         queue.ts worker.ts handlers/{simulate,webhook,retention,expiry}.ts
│   ├── smtp/                              # smtp-server + mailparser adapter
│   │   └── src/ server.ts auth.ts transcript.ts on-data.ts
│   ├── mcp/                               # McpServer factory + tools, transport-agnostic
│   │   └── src/ server.ts tools/{list,get,wait,trigger,override,purge,logs}.ts
│   ├── ui/                                # shadcn/ui on Base UI + tokens (Claude Design later)
│   └── cli/                               # `mailsink` bin: migrate, mcp (stdio proxy, D14)
│                                          # built by tsdown into dist/bin.mjs (+ migrations)
├── docker/
│   ├── Dockerfile                         # multi-stage: deps -> build -> node:24-slim runtime
│   └── docker-compose.yml                 # mailsink + postgres (PGlite profile without pg)
├── docs/
│   ├── architecture/
│   └── contributing/translations.md       # how to add or fix a locale (D17)
├── .github/ workflows/ci.yml  pull_request_template.md  dependabot.yml
│            ISSUE_TEMPLATE/translation.yml
├── AGENTS.md  README.md  CONTRIBUTING.md  LICENSE
├── lingui.config.ts                       # locales [en, fr], sourceLocale en, catalogs path
├── biome.json  pnpm-workspace.yaml  tsconfig.base.json
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

## Configuration (env, validated by Zod at boot)

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `pglite://./data` | `postgres://…` or `pglite://<dir>` / `pglite://memory` |
| `MAILSINK_ADMIN_KEY` | required outside local mode | Admin API and UI login |
| `PORT` / `MAILSINK_SMTP_PORT` | `3000` / `1025` | Listeners (`PORT` is read by Nitro) |
| `MAILSINK_SMTP_HOST` | `0.0.0.0` | SMTP bind address |
| `MAILSINK_SMTP_TLS_CERT` / `_KEY` | unset | Optional STARTTLS |
| `MAILSINK_UI_AUTH` | `admin-key` | `none` for local/CI |
| `MAILSINK_SESSION_SECRET` | derived from admin key | Cookie signing |
| `MAILSINK_DEFAULT_IDLE_TTL` | `3600` | Ephemeral workspaces |
| `MAILSINK_MAX_MESSAGE_BYTES` | `26214400` | Ingestion cap (25 MB) |
| `MAILSINK_PUBLIC_URL` | `http://localhost:3000` | Links in snippets and MCP |
