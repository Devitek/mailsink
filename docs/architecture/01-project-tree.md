# 1. Project tree

pnpm monorepo, TypeScript strict, Biome, Vitest, Playwright. One deployable app; logic in
packages so the HTTP routes, the SMTP server, the workers and MCP share one implementation.
Target: files under ~150 lines, one responsibility each.

```
mailsink/
├── apps/
│   ├── mailsink/                         # TanStack Start app: UI + every HTTP surface (D1)
│   │   ├── vite.config.ts                # tanstackStart() + nitro() + react + tailwind
│   │   ├── nitro.config.ts               # registers runtime/nitro-plugin.ts (D3), copies
│   │   │                                 # packages/db/migrations into .output/server (D42)
│   │   ├── src/
│   │   │   ├── server.ts                 # custom server entry: every request runs in
│   │   │   │                             # withRuntime() (waits for the runtime, D3; leased
│   │   │   │                             # during a dev restart, D148)
│   │   │   ├── router.tsx                # router + QueryClient (SSR dehydrate/hydrate)
│   │   │   ├── testing.ts                # test-only `@mailsink/app/testing`: runtime fixtures and
│   │   │   │                             # the routes folder, for the SDK tests (D259)
│   │   │   ├── runtime/
│   │   │   │   ├── nitro-plugin.ts       # boots at process start (exit 1 on failure, D28),
│   │   │   │   │                         # stops on Nitro `close` (D3)
│   │   │   │   ├── boot.ts               # idempotent start/stop
│   │   │   │   ├── restart.ts            # `vite dev`: restarts the runtime when its code changes
│   │   │   │   │                         # (debounce 500 ms, D3), after the requests in flight
│   │   │   │   │                         # (drain up to 10 s, D148)
│   │   │   │   ├── slot.ts               # globalThis slot (HMR, two bundles), whenRuntimeReady(),
│   │   │   │   │                         # withRuntime() and whenRequestsDrained() (D148)
│   │   │   │   ├── config.ts             # env validated by Zod at boot (D29, « Configuration »)
│   │   │   │   ├── container.ts          # opens + migrates the db, builds the event bus and the
│   │   │   │   │                         # activity tracker, starts SMTP (smtp_sessions through
│   │   │   │   │                         # logs.recordSmtpSession), the job worker (simulate,
│   │   │   │   │                         # deliver_webhook), the retention scheduler, the
│   │   │   │   │                         # ephemeral GC, the override expiry (override.changed,
│   │   │   │   │                         # D96) and the log writer (#35) once; closes what it
│   │   │   │   │                         # started if a later step fails
│   │   │   │   ├── migrations.ts         # migrations folder of the build (D42)
│   │   │   │   └── shutdown.ts           # SIGTERM/SIGINT: wait for the srvx HTTP drain and the
│   │   │   │                             # close hook (SMTP, workers, db), exit 0 (D3)
│   │   │   ├── http/                     # thin adapters shared by server routes
│   │   │   │   ├── handler.ts            # defineApi(): request id -> auth -> extensions ->
│   │   │   │   │                         # parse (Zod) -> handler (D39)
│   │   │   │   ├── extensions.ts         # ApiExtension hooks; DEFAULT_EXTENSIONS: request log,
│   │   │   │   │                         # activity
│   │   │   │   ├── ingestion-guard.ts    # INGESTION_EXTENSIONS: rate limit and chaos, X-RateLimit-*
│   │   │   │   │                         # headers (#24, #25, D90 to D94)
│   │   │   │   ├── logs-extension.ts     # request log: one api_logs row per call (D145 to D147)
│   │   │   │   ├── logs-body.ts          # capped body reads of the request log (D157)
│   │   │   │   ├── auth.ts               # admin key, msk_/mskw_ keys, Brevo api-key header (D41)
│   │   │   │   ├── errors.ts             # DomainError -> error body (ErrorFormatter per dialect,
│   │   │   │   │                         # optional dialect status, D158)
│   │   │   │   ├── validation.ts         # Zod issues -> validation_error details, query, JSON body
│   │   │   │   ├── body-limit.ts         # request body cap (MAILSINK_MAX_MESSAGE_BYTES), buffered
│   │   │   │   │                         # bytes kept for the request log (D157)
│   │   │   │   ├── health.ts             # GET /healthz: liveness + database readiness (D42)
│   │   │   │   ├── mcp.ts                # POST|GET|DELETE /mcp: defineApi() + handleMcpRequest()
│   │   │   │   │                         # with the workspace and MAILSINK_PUBLIC_URL (D165)
│   │   │   │   ├── client-ip.ts          # client address: socket, or the last X-Forwarded-For
│   │   │   │   │                         # entry with MAILSINK_TRUST_PROXY (D182, D185)
│   │   │   │   ├── start-server.ts       # Start request helpers read from a complete namespace
│   │   │   │   │                         # (`vite dev` getCookie race, D183)
│   │   │   │   ├── test-fixtures.ts      # test-only: runtime in the slot (event bus, activity
│   │   │   │   │                         # tracker and log writer included), seeded keys (rows from
│   │   │   │   │                         # @mailsink/db/testing)
│   │   │   │   ├── admin/                # workspaces.ts (Admin API; DELETE publishes
│   │   │   │   │                         # workspace.deleted, D97), public-endpoints.ts (URLs
│   │   │   │   │                         # and SMTP host/port written in credentials),
│   │   │   │   │                         # templates.ts (Brevo templates, #30), logs.ts
│   │   │   │   │                         # (GET /admin/logs/api[/:id], rows without
│   │   │   │   │                         # workspace, D151)
│   │   │   │   ├── native/               # emails.ts: POST /v1/emails, /v1/emails/batch (passes
│   │   │   │   │                         # the event bus to ingestion, #26)
│   │   │   │   ├── dialects/
│   │   │   │   │   ├── resend/           # emails.ts (POST /emails, /emails/batch, GET
│   │   │   │   │   │                     # /emails/:id), errors.ts (Resend error body, D122,
│   │   │   │   │   │                     # D158), extensions.ts (rate limit headers),
│   │   │   │   │   │                     # test-server.ts and test-seed.ts (SDK contract tests)
│   │   │   │   │   └── brevo/            # send.ts (POST /v3/smtp/email), errors.ts (D127),
│   │   │   │   │                         # testing.ts (SDK contract tests)
│   │   │   │   ├── activity.ts           # afterAuth extension: workspace activity touch (#20)
│   │   │   │   └── capture/              # api.ts (list, wait=true, detail, purge through
│   │   │   │                             # core purgeAndPublish), download.ts (raw EML,
│   │   │   │                             # attachments, D60), override.ts (GET, activate, reset
│   │   │   │                             # through core, override.changed, D96), suppressions.ts (D75),
│   │   │   │                             # stream.ts (GET /capture/stream), stream-sse.ts
│   │   │   │                             # (ReadableStream SSE: heartbeat, Last-Event-ID
│   │   │   │                             # replay, filters), logs.ts (GET /capture/logs/api,
│   │   │   │                             # /capture/logs/smtp and their :id, #35), events.ts
│   │   │   │                             # (POST /capture/messages/:id/events, #34),
│   │   │   │                             # webhooks.ts (endpoints, preview, test send, #32,
│   │   │   │                             # 422 private_webhook_url, D150), webhooks-deliveries.ts
│   │   │   │                             # (delivery log, detail, replay, #33), demo.ts
│   │   │   │                             # (POST /capture/demo, #62)
│   │   │   ├── routes/
│   │   │   │   ├── __root.tsx                        # html shell: locale, theme, instance and public
│   │   │   │   │                                     # URL loaded during SSR; head: product title,
│   │   │   │   │                                     # social tags per locale
│   │   │   │   ├── index.tsx                         # workspace picker (PickerSearch, D164)
│   │   │   │   ├── login.tsx                         # admin-key sign-in page, POST /login handler
│   │   │   │   │                                     # (D13, D160 to D163)
│   │   │   │   ├── w.$workspaceSlug.tsx              # workspace layout (guarded): header, tabs
│   │   │   │   │                                     # (own row below 768 px), live indicator,
│   │   │   │   │                                     # ephemeral TTL banner, one SSE stream
│   │   │   │   ├── w.$workspaceSlug.index.tsx        # inbox + message viewer (InboxSearch: ?m=,
│   │   │   │   │                                     # ?tab=, filters; D177, D179)
│   │   │   │   ├── w.$workspaceSlug.connections.tsx  # workspace card, workspace key, connections
│   │   │   │   │                                     # (ConnectionsSearch, D171)
│   │   │   │   ├── w.$workspaceSlug.m.stream.ts      # SSE of the workspace behind the UI session
│   │   │   │   ├── w.$workspaceSlug.m.$messageId.raw.ts          # EML download (session)
│   │   │   │   ├── w.$workspaceSlug.m.$messageId.html.ts         # preview document (CSP,
│   │   │   │   │                                                 # ?remote=blocked, D187)
│   │   │   │   ├── w.$workspaceSlug.m.$messageId.attachments.$attachmentId.ts
│   │   │   │   ├── w.$workspaceSlug.logs.tsx         # logs explorer (LogsSearch: tab, facets,
│   │   │   │   │                                     # more filters, page, ?inspect=; D190, D213)
│   │   │   │   ├── w.$workspaceSlug.suppressions.tsx # suppression list (SuppressionsSearch,
│   │   │   │   │                                     # D198, D214)
│   │   │   │   ├── w.$workspaceSlug.settings.tsx     # settings (SettingsSearch ?section=:
│   │   │   │   │                                     # connections, webhooks, retention &
│   │   │   │   │                                     # suppression, simulation, templates, mcp)
│   │   │   │   ├── admin.workspaces.ts               # POST, GET
│   │   │   │   ├── admin.workspaces.$id.ts           # GET, PATCH (D186), DELETE
│   │   │   │   ├── admin.workspaces.$id.key.rotate.ts            # POST: new mskw_ key (D207)
│   │   │   │   ├── admin.workspaces.$id.connections.ts           # POST (D186)
│   │   │   │   ├── admin.workspaces.$id.connections.$connectionId.ts  # PATCH, DELETE (D186)
│   │   │   │   ├── admin.workspaces.$id.connections.$connectionId.rotate.ts  # POST (D172)
│   │   │   │   ├── admin.workspaces.$id.templates.ts # Brevo templates: GET, POST (#30)
│   │   │   │   ├── admin.workspaces.$id.templates.$templateId.ts # GET, PATCH, DELETE
│   │   │   │   ├── admin.logs.api.ts                 # GET API logs without workspace (D151)
│   │   │   │   ├── admin.logs.api.$id.ts             # GET one of them
│   │   │   │   ├── v1.emails.ts                      # native single send
│   │   │   │   ├── v1.emails.batch.ts
│   │   │   │   ├── emails.ts                         # Resend dialect
│   │   │   │   ├── emails.batch.ts
│   │   │   │   ├── emails.$id.ts                     # Resend GET /emails/:id
│   │   │   │   ├── v3.smtp.email.ts                  # Brevo dialect
│   │   │   │   ├── capture.messages.ts               # GET (wait=true), DELETE
│   │   │   │   ├── capture.messages.$id.ts
│   │   │   │   ├── capture.messages.$id.events.ts
│   │   │   │   ├── capture.messages.$id.attachments.$attId.ts
│   │   │   │   ├── capture.messages.$id.raw.ts       # message/rfc822 download
│   │   │   │   ├── capture.override.ts               # GET current, POST activate
│   │   │   │   ├── capture.override.reset.ts
│   │   │   │   ├── capture.suppressions.ts           # GET, DELETE (reset)
│   │   │   │   ├── capture.demo.ts                   # POST: demo messages (#62)
│   │   │   │   ├── capture.logs.api.ts               # GET API logs (filters, pages)
│   │   │   │   ├── capture.logs.api.$id.ts           # GET one API log (headers, bodies)
│   │   │   │   ├── capture.logs.smtp.ts              # GET SMTP sessions
│   │   │   │   ├── capture.logs.smtp.$id.ts          # GET one session (transcript)
│   │   │   │   ├── capture.webhooks.ts                   # GET, POST endpoints
│   │   │   │   ├── capture.webhooks.$id.ts               # GET, PATCH, DELETE
│   │   │   │   ├── capture.webhooks.preview.ts           # sample body + headers
│   │   │   │   ├── capture.webhooks.$id.[test].ts        # POST /capture/webhooks/:id/test
│   │   │   │   ├── capture.webhooks.deliveries.ts        # delivery log
│   │   │   │   ├── capture.webhooks.deliveries.$id.ts    # one delivery and its attempts
│   │   │   │   ├── capture.webhooks.deliveries.$id.replay.ts
│   │   │   │   ├── capture.stream.ts                 # SSE
│   │   │   │   ├── mcp.ts                            # Streamable HTTP (stateless)
│   │   │   │   └── healthz.ts
│   │   │   ├── auth/                      # web UI sign-in (D13, D160 to D163)
│   │   │   │   ├── session.ts             # UI auth settings, cookie options, session status
│   │   │   │   ├── session-token.ts       # signed stateless session token (HMAC, expiry)
│   │   │   │   ├── session.server.ts      # request-bound: read / clear the cookie, limiter key
│   │   │   │   ├── login-limiter.ts       # failed sign-ins per client address, Retry-After
│   │   │   │   ├── login-handler.ts       # POST /login: key check, cookie, redirect or 401 / 429
│   │   │   │   ├── login-route.server.ts  # POST /login in the request context
│   │   │   │   ├── auth-fns.ts            # server functions: login state, sign out
│   │   │   │   ├── guard.ts               # ensureSignedIn(): route guard, back to the page asked
│   │   │   │   └── redirect.ts            # safeRedirect(): same-origin paths only
│   │   │   ├── server-fns/                # createServerFn wrappers for the UI, by feature;
│   │   │   │   │                          # *-fns.ts: session-checked server functions
│   │   │   │   │                          # (signedIn), *.server.ts: their server side
│   │   │   │   ├── instance-fns.ts        # version (MAILSINK_VERSION) and UI auth mode
│   │   │   │   ├── workspaces-fns.ts      # picker pages (persistent / ephemeral apart,
│   │   │   │   │                          # search, keyset pages, D206), one workspace
│   │   │   │   ├── workspaces.server.ts   # their server side, last workspace cookie
│   │   │   │   ├── workspaces-manage-fns.ts  workspaces-manage.server.ts  # create (UI),
│   │   │   │   │                          # edit, delete, rotate the mskw_ key (D170, D174)
│   │   │   │   ├── connections-fns.ts  connections.server.ts  connections-types.ts
│   │   │   │   │                          # connections page: list with message counts,
│   │   │   │   │                          # create, rename, disable, rotate, delete (D171)
│   │   │   │   ├── messages-fns.ts  messages.server.ts  messages-types.ts  # inbox pages,
│   │   │   │   │                          # facets, previews, message, raw source, purge
│   │   │   │   ├── message-origin.server.ts  # API request or SMTP envelope of a message
│   │   │   │   ├── events-fns.ts  events.server.ts  # « Simulate » of the viewer (D180)
│   │   │   │   ├── demo-fns.ts  demo.server.ts  # « Load demo messages » (#62)
│   │   │   │   ├── logs-fns.ts  logs.server.ts  logs-types.ts  logs-signature.ts  # logs
│   │   │   │   │                          # explorer reads, replay, signature check (D191)
│   │   │   │   ├── override-fns.ts  override.server.ts  override-types.ts  # override panel
│   │   │   │   ├── suppressions-fns.ts  suppressions.server.ts  # suppression list (D198)
│   │   │   │   ├── settings-fns.ts  settings.server.ts  settings-types.ts
│   │   │   │   │                          # settings-catalog.ts: workspace defaults (D201)
│   │   │   │   ├── webhooks-fns.ts  webhooks.server.ts  webhooks-types.ts  # endpoints
│   │   │   │   ├── templates-fns.ts  templates.server.ts  # Brevo templates, pages of 200
│   │   │   │   └── workspace-types.ts     # UI views of a workspace
│   │   │   ├── http/start-server.ts       # request helpers of TanStack Start (cookies,
│   │   │   │                              # request), never imported statically (#99, #106)
│   │   │   ├── features/                  # UI, one folder per feature
│   │   │   │   ├── login/                 # sign-in screen, key field, banners, countdown
│   │   │   │   ├── shell/                 # app header, nav tabs (typed Links, inline or
│   │   │   │   │                          # mobile bar), « Language and session » menu,
│   │   │   │   │                          # instance block, use-copy.ts and copy-button.tsx
│   │   │   │   │                          # (clipboard + toast), count.tsx
│   │   │   │   ├── workspaces/            # picker popover and page sections (search, paged
│   │   │   │   │                          # sections, Base UI Switch "show ephemeral"),
│   │   │   │   │                          # ephemeral badge and banner, create / edit dialogs
│   │   │   │   │                          # (TanStack Form), confirm dialog, queries
│   │   │   │   ├── inbox/                 # TanStack Virtual list, filter bar, facets, empty
│   │   │   │   │                          # state (« Load demo messages », #62), search
│   │   │   │   │                          # query, session routes, queries
│   │   │   │   ├── message-viewer/        # header + Simulate bar, sandboxed preview (desktop /
│   │   │   │   │                          # mobile, background, remote images blocked or not),
│   │   │   │   │                          # text, links, headers + source (payload / EML),
│   │   │   │   │                          # history (events, webhook deliveries), downloads
│   │   │   │   ├── logs/                  # DataTables of the three tabs, facets, « More
│   │   │   │   │                          # filters » (more-filters.ts), page pager, Sheet
│   │   │   │   │                          # inspectors, replay, live cache (D190 to D194)
│   │   │   │   ├── connections/           # TanStack Form, kind-conditional fields, panels
│   │   │   │   │                          # (credentials shown once, « Active webhooks »),
│   │   │   │   │                          # workspace key card
│   │   │   │   ├── webhooks/              # scope -> payloadFormat prefill, dialect event
│   │   │   │   │                          # labels, live payload/headers preview
│   │   │   │   ├── override/              # header pill and side panel: rates sum <= 100,
│   │   │   │   │                          # latency, chaos, rate limit, rules (D195 to D199)
│   │   │   │   ├── suppressions/          # suppression list on the DataTable (virtualized
│   │   │   │   │                          # beyond 200 rows), total, filter, reset (D214)
│   │   │   │   ├── settings/              # settings page: section nav, connections,
│   │   │   │   │                          # retention & suppression, simulation (D200, D201)
│   │   │   │   ├── templates/             # Brevo templates: list (« Load more »), editor,
│   │   │   │   │                          # server-rendered preview (D203)
│   │   │   │   ├── mcp-config/            # MCP endpoint and client snippets (D204)
│   │   │   │   └── realtime/              # useWorkspaceStream(): EventSource -> Query cache
│   │   │   │                              # (apply-stream-event.ts, D178), live indicator
│   │   │   ├── i18n/                      # Lingui (D17, D18)
│   │   │   │   ├── lingui.ts              # i18n instance, dynamic catalog loading
│   │   │   │   ├── locales.ts             # supported locales, source locale, cookie name
│   │   │   │   ├── resolve-locale.ts      # cookie > Accept-Language > en (pure)
│   │   │   │   ├── locale.server.ts       # reads the request, writes the cookie (D37)
│   │   │   │   ├── locale-fns.ts          # server functions for loaders and the switcher
│   │   │   │   └── locale-switcher.tsx
│   │   │   ├── locales/
│   │   │   │   ├── en/messages.po         # source locale
│   │   │   │   └── fr/messages.po
│   │   │   ├── lib/query-keys.ts
│   │   │   ├── theme/                     # light/dark theme: themes.ts, theme-context.tsx
│   │   │   │                              # (one context per process, D149), theme-toggle.tsx,
│   │   │   │                              # theme-fns.ts, theme.server.ts
│   │   │   ├── seo/                       # social-meta.ts (Open Graph and Twitter tags, image
│   │   │   │                              # per locale), page-title.ts (localized <title> per
│   │   │   │                              # page, D183), public-url-fns.ts (MAILSINK_PUBLIC_URL)
│   │   │   └── styles/                    # app.css (Tailwind entry, imports @mailsink/ui tokens),
│   │   │                                  # fonts.css (self-hosted fonts, B1-5)
│   │   ├── public/                        # brand assets: favicon.svg, mark-*.png, maskable-*.png,
│   │   │                                  # apple-touch-icon-180.png, manifest.webmanifest,
│   │   │                                  # og-image-{en,fr}-1200x630.png (docs/design/og/)
│   │   └── tests/e2e/                     # Playwright against the production build
│   │       ├── web-server.ts              # shared config: ports, admin key, webServer
│   │       ├── goto-hydrated.ts           # gotoHydrated(page, url): waits for <html
│   │       │                              # data-hydrated> before any click (D263)
│   │       ├── workspace-api.ts           # workspaces of the UI scenarios through the SDK
│   │       │                              # (createWorkspace, adminSdk) and the raw
│   │       │                              # adminContext / deleteWorkspace (D263)
│   │       ├── serve.ts                   # node <entry> on a throwaway PGlite directory
│   │       ├── smoke.spec.ts  smoke-theme.spec.ts  locale.spec.ts
│   │       ├── inbox.spec.ts  inbox-fixtures.ts  workspaces.spec.ts  workspaces-screens.spec.ts
│   │       ├── ui/                        # sign-in, picker (search, banner), session menu,
│   │       │                              # contrast, mobile (390 px), workspace key,
│   │       │                              # ephemeral banner on a skewed clock (D261); the
│   │       │                              # login-limit.spec.ts scenario runs alone, last
│   │       ├── recipe/                    # docs/guides/e2e.md, on @devitek/mailsink-playwright:
│   │       │                              # fixtures.ts (workspace per worker, `app` sending
│   │       │                              # with the Resend SDK), recipe.spec.ts (send, matchers,
│   │       │                              # per-recipient status, links with rebase, bounce
│   │       │                              # override), realtime.spec.ts (SSE
│   │       │                              # stream, wait=true on the built server),
│   │       │                              # brevo.spec.ts (official SDK, template),
│   │       │                              # webhooks.spec.ts (local receiver, test send)
│   │       └── fallback/                  # own build with a test-only `de` locale (D64):
│   │                                      # playwright.config.ts, vite.config.ts,
│   │                                      # lingui.config.ts, de.po, fallback.spec.ts,
│   │                                      # messages.ts (test-only EN tagline of that build)
│   └── docs/                              # documentation website (D265), Astro Starlight,
│       │                                  # GitHub Pages at mailsink.devitek.fr (D268)
│       ├── astro.config.ts                # Starlight, sidebar, starlight-openapi (D266),
│       │                                  # starlight-links-validator (D269)
│       ├── scripts/                       # sync.ts (repository Markdown -> content collection,
│       │                                  # quick start, openapi.json), pages.ts (what renders
│       │                                  # where), links.ts, markdown.ts (D266)
│       ├── src/content/docs/index.mdx     # landing page (the rest of the collection and
│       │                                  # src/generated/ are synced at build, git-ignored)
│       ├── src/styles/brand.css           # Starlight colors and fonts on the --ms-* tokens (D267)
│       ├── public/                        # favicon.svg, CNAME (mailsink.devitek.fr)
│       └── test/                          # links, markdown
├── packages/
│   ├── contracts/                         # Zod, shared end to end (doc 03)
│   │   └── src/
│   │       ├── common.ts   address.ts   status.ts   ids.ts   errors.ts (ErrorCode, ApiErrorBody)
│   │       ├── admin.ts    native.ts    resend.ts   brevo.ts
│   │       ├── capture.ts  override.ts  stream.ts (SSE events, D80)  suppression.ts
│   │       ├── logs.ts                  # API logs and SMTP sessions: queries, views (#35)
│   │       ├── templates.ts             # Brevo templates (#30)
│   │       ├── webhook.ts               # endpoints, canonical events, preview, test (#32)
│   │       ├── webhook-delivery.ts      # deliveries, attempts, replay (#33)
│   │       ├── webhook-payloads.ts      # unified, Resend and Brevo payload shapes (D21)
│   │       ├── settings.ts              # retention, rate limit, simulation defaults
│   │       ├── search-params.ts         # UI search params (PickerSearch, InboxSearch,
│   │       │                            # ConnectionsSearch)
│   │       ├── workspace-manage.ts      # workspace / connection edits, CreatedConnection,
│   │       │                            # RotatedWorkspaceKey, slugify
│   │       ├── server-clock.ts          # server time from Date headers (SDK, web UI, D261)
│   │       └── version.ts               # MAILSINK_VERSION, from the root package.json (D181)
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
│   │                                        # connections, events-stream (replay reads),
│   │                                        # idempotency, jobs, logs-api, logs-smtp,
│   │                                        # logs-query (shared filters, sort, offset),
│   │                                        # messages-read, messages-write,
│   │                                        # messages-status, messages-purge,
│   │                                        # messages-inbox (inbox pages and facets),
│   │                                        # overrides,
│   │                                        # retention, retention-webhooks (D154),
│   │                                        # suppressions, templates, webhooks,
│   │                                        # webhooks-context, webhooks-deliveries,
│   │                                        # webhooks-delivery-facts (endpoint URL, last
│   │                                        # attempt duration, D205),
│   │                                        # workspace-activity (throttled touch),
│   │                                        # workspace-message-counts (per workspace, per
│   │                                        # connection), workspaces, workspaces-write
│   ├── core/                              # domain services, no HTTP, no React; depends on
│   │   │                                  # @mailsink/contracts, @mailsink/db, drizzle-orm (query
│   │   │                                  # builders in services) and nodemailer (EML composer)
│   │   └── src/
│   │       ├── clock.ts  errors.ts (DomainError, status per code, D40)
│   │       ├── crypto.ts (key hash, constant-time compare; scrypt, hmac later)  # ids: db (D27)
│   │       ├── workspaces/   provision.ts queries.ts update.ts views.ts slug.ts activity.ts
│   │       │                 expiry.ts workspace-key.ts (mskw_ rotation, D207)
│   │       ├── connections/  credentials.ts snippets.ts plan.ts manage.ts (add, rename,
│   │       │                 disable, rotate, delete; UI and Admin API, D186)
│   │       ├── ingestion/    pipeline.ts (fans out `suppressed`, D153) prepare.ts normalize.ts
│   │       │                 native.ts compose-eml.ts links.ts idempotency.ts
│   │       │                 stream-frames.ts testing/fixtures.ts
│   │       ├── demo/         catalog.ts copy.ts copy-{en,fr}.ts layout.ts seed.ts  # #62,
│   │       │                 demo set through persistEmails, per-message rules (D210, D211)
│   │       ├── dialects/     native.ts smtp.ts resend.ts (to NormalizedEmail)
│   │       │                 resend-ingest.ts resend-read.ts (POST /emails, GET /emails/:id)
│   │       │                 brevo/{normalize,send}.ts
│   │       ├── templates/    render.ts service.ts views.ts         # Brevo {{ params.x }}, #30
│   │       ├── events-api/   manual.ts (POST …/events, #34) engagement.ts (opened / clicked)
│   │       │                 publish-trigger.ts (triggerAndPublishEvent, D180)
│   │       ├── rate-limit/   token-bucket.ts request-guard.ts (guardRequest, smtpGuardReply)
│   │       │                 smtp-reply.ts                         # D90 to D92
│   │       ├── chaos/        draw.ts smtp-reply.ts                 # D93, D94
│   │       ├── logs/         writer.ts (createLogWriter, recordSmtpSession) sanitize.ts
│   │       │                 transcript.ts query.ts views.ts       # #35, D145 to D147
│   │       ├── suppression/  service.ts (pages with total and connection, D214)
│   │       ├── overrides/    service.ts views.ts expiry.ts publish.ts (override.changed, D96;
│   │       │                 activate / reset and publish, D180)
│   │       ├── events/       bus.ts frames.ts filter.ts replay.ts  # D6, D80 to D84
│   │       │                 live.ts (LiveDeps: db + bus of the publishing services)
│   │       ├── webhooks/     endpoints.ts endpoint-input.ts url-guard.ts (D150, D155)
│   │       │                 fanout.ts context.ts jobs.ts attempt.ts send.ts retry.ts
│   │       │                 deliveries.ts (log, replay) sample.ts sample-send.ts secret.ts
│   │       │                 publish.ts (webhook.delivery frames) views.ts
│   │       │   └── formatters/            # Strategy, one per payloadFormat (D20, D21)
│   │       │       types.ts events-map.ts shared.ts unified.ts resend.ts brevo.ts index.ts
│   │       ├── capture/      service.ts query.ts cursor.ts views.ts wait.ts inbox.ts (UI
│   │       │                 inbox pages, facets, previews)
│   │       │                 publish-purge.ts (purgeAndPublish, D180)
│   │       │                 testing/fixtures.ts (@mailsink/core/capture-testing)
│   │       ├── blobs/        store.ts db-store.ts
│   │       ├── simulation/   simulate-delivery.ts (one run, D70) planner.ts settings-planner.ts
│   │       │                 load-settings.ts settings-resolver.ts decide.ts rules.ts draw.ts
│   │       │                 rng.ts recorder.ts aggregate.ts snapshot.ts testing/fixtures.ts
│   │       │                 fan-out-run.ts (engagement + webhooks in the run, D152)
│   │       │                 (doc 04, « Simulation files »)
│   │       ├── retention/    run.ts scheduler.ts (also purges and reports failed jobs, D65,
│   │       │                 and finished webhook deliveries, D154)
│   │       └── jobs/         queue.ts worker.ts backoff.ts settings.ts (DEFAULT_JOB_SETTINGS)
│   │                         handlers/{simulate,simulate-publish,simulate-webhooks,
│   │                         deliver-webhook}.ts
│   ├── smtp/                              # smtp-server + mailparser adapter
│   │   └── src/ server.ts auth.ts credential-cache.ts guard.ts (MAIL FROM, D132)
│   │            on-data.ts sessions.ts session-record.ts transcript.ts tls.ts (D134)
│   │            testing.ts (contract test harness, raw SMTP dialogue)
│   ├── mcp/                               # McpServer factory + tools, transport-agnostic
│   │   └── src/ server.ts (factory, serverInfo version D181) http.ts (stateless Streamable
│   │            HTTP, D165, D169) context.ts result.ts schemas.ts urls.ts (absolute URLs)
│   │            tools/{messages,content,actions,override,logs}.ts testing.ts
│   ├── ui/                                # shadcn/ui on Base UI + design tokens
│   │   └── src/ index.ts  components/ (brand, button, card, data-table (+ data-table-rows:
│   │            virtual rows, hidden columns, row labels, D216), data-table-facet,
│   │            data-table-pagination (D194), dialog, field, input, menu, popover,
│   │            segmented-control (the only one, D208), select, sheet, status-badge, switch,
│   │            tabs, textarea (D200), toast (D208))  lib/cn.ts  styles/ (tokens.css, tokens-ext.css
│   │            with the faint text override D184, theme.css, index.css, css-declarations.ts,
│   │            contrast.ts)
│   ├── openapi/                           # @mailsink/openapi: OpenAPI 3.1 document from the
│   │   └── src/                           # contracts (D230 to D234): registry.ts, routes/,
│   │                                      # document.ts, cli.ts (`pnpm openapi [file]`)
│   ├── sdk/                               # npm @devitek/mailsink: TypeScript SDK (D235 to D239)
│   │   ├── src/                           # client.ts (Mailsink interface, now()), http.ts
│   │   │                                  # (transport, server clock D261), admin/,
│   │   │                                  # capture/ (messages, waitFor, overrides, webhooks,
│   │   │                                  # logs), stream/ (SSE), helpers/ (links, codes),
│   │   │                                  # contract-types.ts (Zod-derived types, source) and
│   │   │                                  # types.ts (plain types generated from it, D260)
│   │   ├── scripts/generate-types.ts      # `generate:types`: writes types.ts and
│   │   │                                  # test/types-fidelity.ts (D260)
│   │   ├── test/                          # Vitest on the real routes (@mailsink/app/testing),
│   │   │                                  # openapi-responses.test.ts (answers vs registry, D262)
│   │   └── tsdown.config.ts               # dist/index.js (contracts bundled) + index.d.ts
│   ├── playwright/                        # npm @devitek/mailsink-playwright (#126, D240 to D244)
│   │   ├── src/                           # fixtures.ts (mailsinkWorkspace per worker,
│   │   │                                  # mailsink per test), workspace.ts (provision,
│   │   │                                  # dispose, .env), options.ts, session.ts
│   │   │                                  # (expectEmail, withOverride, since on the server
│   │   │                                  # clock), expect-email.ts, matchers.ts (toHaveLink,
│   │   │                                  # toHaveAttachment, toHaveStatus), links.ts (getLink,
│   │   │                                  # getCode, openLink, rebaseUrl), reset.ts, refresh.ts
│   │   └── test/                          # units.test.ts, lifecycle.test.ts (real routes,
│   │                                      # both drivers)
│   ├── vitest/                            # npm @devitek/mailsink-vitest (#127)
│   │   ├── src/                           # global-setup.ts (workspace per run), setup.ts
│   │   │                                  # (matchers), fixtures.ts (createMailsinkTest, file
│   │   │                                  # or worker scope), workspace.ts, jest.ts,
│   │   │                                  # matchers/ (received, message, context)
│   │   └── test/                          # fixtures-suite.ts run on both drivers by
│   │                                      # fixtures.test.ts and fixtures.postgres.test.ts
│   │                                      # (D264), jest-project/ (Jest run)
│   └── cli/                               # npm @devitek/mailsink-cli: `mailsink` bin, built by
│       │                                  # tsdown into dist/bin.mjs (+ migrations, D251)
│       ├── src/                           # bin.ts, index.ts (dispatch), parse.ts, usage.ts,
│       │                                  # output.ts, config.ts, errors.ts (exit codes D252),
│       │                                  # migrations-folder.ts, commands/ (migrate, mcp
│       │                                  # stdio proxy D14, workspace, wait, override, purge)
│       └── test/                          # cli, parse, pilot (real routes), mcp (stdio)
├── docker/
│   ├── Dockerfile                         # multi-stage: pnpm-spec (pnpm version and
│   │                                      # version-less root manifest from package.json)
│   │                                      # -> base -> deps -> build -> node:24-slim runtime
│   ├── docker-compose.yml                 # mailsink + postgres (PGlite profile without pg,
│   │                                      # named volume pglite-data); STARTTLS PEM files
│   │                                      # mounted from MAILSINK_SMTP_TLS_DIR (D159)
│   └── smoke-test.sh                      # built image: healthy, /healthz 200, SMTP 220, CLI
├── .dockerignore
├── docs/                                  # rendered by apps/docs, links rewritten (D266)
│   ├── architecture/
│   ├── design/                            # design deliveries kept verbatim (brand-1, brief-2),
│   │                                      # og/ (Open Graph images EN and FR, #36)
│   ├── guides/e2e.md                      # E2E recipe: workspace per worker, wait=true, overrides
│   ├── guides/mcp.md                      # MCP clients (Claude Code, Claude Desktop, Cursor), tools
│   ├── guides/api.md                      # HTTP API, OpenAPI document, generated clients
│   ├── guides/sdk.md                      # TypeScript SDK (@devitek/mailsink)
│   ├── guides/vitest-jest.md  cli.md      # Vitest/Jest helpers, CLI
│   └── contributing/translations.md       # how to add or fix a locale (D17)
├── .github/ workflows/ci.yml             # lint, typecheck, test (PGlite + Postgres), build, e2e,
│            │                            # npm packs (packages), SDK on Node 20/22/24 (D258)
│            workflows/docker.yml         # image build + docker/smoke-test.sh (never pushes)
│            workflows/release-please.yml # release PR, tag, GitHub release (D220), then calls:
│            workflows/release-image.yml  # GHCR multi-arch publication of a tag (D222)
│            workflows/release-npm.yml    # npm publication of the @devitek packages (D255, D256)
│            workflows/release-openapi.yml  # openapi.json attached to the release (D257)
│            scripts/                     # public-packages.mjs (what is published),
│            │                            # pack-public.sh + check-pack.mjs (build, pack, check),
│            │                            # sdk-smoke.mjs (packed SDK on every Node version)
│            pull_request_template.md  dependabot.yml  ISSUE_TEMPLATE/translation.yml
├── release-please-config.json  .release-please-manifest.json   # D220, D221
├── AGENTS.md  README.md  CONTRIBUTING.md  LICENSE  CHANGELOG.md (release-please)
├── lingui.config.ts                       # locales [en, fr], sourceLocale en, catalogs path
├── biome.json  pnpm-workspace.yaml  tsconfig.base.json
├── tsconfig.json                          # typechecks root files (lingui.config.ts, vitest configs)
├── vitest.config.ts  vitest.shared.ts     # projects, CI workers; DB suite timeouts (D264)
```

## Runtime topology (D3)

```
node .output/server/index.mjs
 ├─ HTTP :3000 (Nitro/srvx) ── TanStack Start handler
 │     ├─ SSR UI + server functions
 │     └─ server routes: /admin, /v1, /emails, /v3, /capture, /mcp, /healthz
 ├─ SMTP :1025 (smtp-server)            ─┐
 ├─ job worker (simulate, webhook)       ├─ started by runtime/nitro-plugin.ts at process
 └─ schedulers (retention, ephemeral GC,─┘  start (boot.ts), share container
    override expiry)
```

Boot order: config, database and migrations, SMTP listener, worker; any failure exits 1
(D28). Stop order on SIGTERM: HTTP drain (srvx), SMTP, worker and schedulers, pending
activity touches, pending log writes, database (D3). A `vite dev` restart first waits for
the requests still running on the old runtime (at most 10 s), then stops it the same way
(D148).

## Configuration (env, validated by Zod at boot)

`src/runtime/config.ts` validates every variable of the table below at boot; a new variable
joins the schema with the feature using it. An invalid value stops the boot with exit
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
| `MAILSINK_SMTP_TLS_CERT` / `_KEY` | unset | STARTTLS PEM file paths, both or neither, read at boot (D134); in docker-compose, files of `MAILSINK_SMTP_TLS_DIR` under `/app/tls` (D159) |
| `MAILSINK_WEBHOOK_BLOCK_PRIVATE` | `false` | `true` refuses webhook URLs resolving to private, loopback or link-local addresses, at creation and at send time (D150, D155) |
| `MAILSINK_UI_AUTH` | `admin-key` | `none`: no sign-in at all, for local runs and CI (D13) |
| `MAILSINK_SESSION_SECRET` | derived from the admin key | Session cookie signing, at least 32 characters (D160) |
| `MAILSINK_SESSION_TTL` | `604800` (7 days) | Session lifetime: seconds or a duration (`12h`), 60 s to 1 year |
| `MAILSINK_UI_LOGIN_MAX_ATTEMPTS` / `_LOCK_SECONDS` | `5` / `60` | Failed sign-ins per client address within the window, then a pause of that length (`Retry-After`, D161) |
| `MAILSINK_TRUST_PROXY` | `false` | `true` (behind a reverse proxy): the client address of the sign-in limiter and of the request log `ip` is the last `X-Forwarded-For` entry, not the socket address (D182, D185) |
