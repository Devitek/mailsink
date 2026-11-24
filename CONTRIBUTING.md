# Contributing to Mailsink

Thanks for helping. This guide covers code contributions and translations.

## Ground rules

- **One issue per change.** Open or pick an issue first. Issues are usually written in
  French, but English issues and comments are welcome.
- **Never push to `main`.** Fork, branch, open a pull request.
- **Conventional Commits** with the issue number: `fix(smtp): handle AUTH LOGIN (#42)`.
- **Pull requests are squash merged**: the PR title becomes the commit on `main`, so it
  must be a Conventional Commit too (`type(scope): description (#N)`, no space before the
  colon). It is what lands in the changelog.
- **Green CI**: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm i18n:check`.
- Fill in the pull request template (summary, checks, follow-ups, linked issues).

## Development setup

Requirements: Node.js 24 (see `.node-version`) and pnpm 11 (`corepack enable` picks the
version pinned in `package.json`).

```sh
pnpm install
pnpm dev          # http://localhost:3000, health check at /healthz
```

| Command | What it does |
|---|---|
| `pnpm lint` / `pnpm lint:fix` | Biome lint and format check (code only, Markdown is not formatted) |
| `pnpm typecheck` | `tsc --noEmit` in every workspace package |
| `pnpm test` | Vitest, every package and app as a project |
| `pnpm build` / `pnpm start` | Build every package that has a build (the app with Nitro to `apps/mailsink/.output/`, the CLI to `packages/cli/dist/`) and run the app |
| `pnpm docs:dev` / `pnpm docs:build` | Documentation website (`apps/docs`, http://localhost:4321): renders `README.md`, `CONTRIBUTING.md` and `docs/` (guides, architecture, contributing) plus the OpenAPI reference; the build fails on a broken link |
| `pnpm --filter @mailsink/docs check:external` | After `docs:build`: checks the external links of the site (a 404 or 410 fails, an unreachable site only warns, `--strict` fails on both; successes cached a week) |

The website has no copy of the documentation: edit the Markdown files of the repository,
with relative links between them as usual (they work on GitHub and are rewritten for the
site). A new page is declared in `apps/docs/scripts/pages.ts`. Pushes to `main` publish the
site to https://mailsink.devitek.fr.

Mermaid diagrams (```` ```mermaid ```` blocks) render on GitHub as usual and in the reader's
browser on the site, in the light or dark theme of its selector, with `docs:dev` as with
`docs:build`; no browser is needed to build the site. The build fails on a diagram that does
not parse: a `;` inside a message ends the statement for Mermaid, write `,` instead. Keep a
sequence diagram to a handful of participants: split a long flow into several diagrams
rather than one wide one (`docs/architecture/04-sequence.md`).

`docs:build` prints a `[DEP0169] url.parse()` deprecation warning while it renders the API
reference: it comes from `httpsnippet` 3.0.10 (its latest release), which
`starlight-openapi` uses for the request samples. It is harmless and expected until
`httpsnippet` moves to the WHATWG URL API (D273).

`pnpm install` builds native helpers only for the packages listed under `allowBuilds` in
`pnpm-workspace.yaml` (today `esbuild`, needed by Vite and drizzle-kit): pnpm 11 refuses
dependency build scripts that are not allowed there. If a new dependency needs its install
script, add it to `allowBuilds` in the same pull request and say why.

### Database and runtime

`DATABASE_URL` defaults to `pglite://./data` (embedded Postgres, nothing to install);
`pglite://memory` keeps nothing, `postgres://…` uses a real server. Migrations run at every
boot. The process exits with code 1 when it cannot start (invalid configuration, database
unreachable, SMTP port taken), so check the first `[mailsink]` lines of the log.

`pnpm test` runs every DB test on PGlite; set `TEST_DATABASE_URL` to also run them on
Postgres (each test file gets its own throwaway database):

```sh
docker run -d --name mailsink-pg -e POSTGRES_USER=mailsink -e POSTGRES_PASSWORD=mailsink \
  -e POSTGRES_DB=mailsink_test -p 5432:5432 postgres:18-alpine
TEST_DATABASE_URL=postgres://mailsink:mailsink@localhost:5432/mailsink_test pnpm test
```

**Runtime code reloads by restarting the runtime.** The runtime (database, SMTP listener,
workers) lives in a `globalThis` slot, one per process. When you edit code the Nitro plugin
imports (`apps/mailsink/src/runtime/*`, `packages/core`, `packages/db`, `packages/smtp`),
Vite re-evaluates the plugin and `pnpm dev` stops the running runtime, then boots a new one
from the new code (`[mailsink] runtime code changed, restarting runtime` in the log). Edits
less than 500 ms apart share one restart; requests arriving during the restart wait for the
new runtime. A broken edit logs the error and leaves no runtime running: the next edit
retries. UI components keep hot reloading without touching the runtime.

One edit makes Vite evaluate the plugin once per environment (two or three times); the
evaluations join one restart and the message is logged once. A request reaching the dev
server while the worker is busy restarting (PGlite initialisation blocks its event loop
for a few seconds) waits; one `read ECONNRESET` was seen once before restarts were
debounced, on a keep-alive socket between Vite and the Nitro worker. It was not reproduced
since: 16 chained edits 0.4 s apart under 600 requests on `/healthz`, `/capture/messages`
and `/`, then 126 chained edits of `packages/core`, `packages/db` and `src/runtime`
(0.1 s to 3 s apart) under about 33 000 keep-alive requests from 12 concurrent clients
(`/healthz`, `/`, Admin GET and POST, `POST /v1/emails` with a 5 kB body). If it shows
up, retry the request and report the edit sequence. Those runs did show two known dev-only
glitches: a request in flight while the runtime stops may answer 500 (`PGlite is closed`),
and an SSR render racing a hot update may answer 500 (`useTheme must be used inside
<ThemeProvider>`); retry the request.

Layout: `apps/mailsink` is the TanStack Start app (web UI and every HTTP surface);
`packages/*` hold the shared code (`contracts`, `db`, `core`, `smtp`, `mcp`, `ui`, `cli`),
consumed as TypeScript sources. `apps/mailsink/src/routeTree.gen.ts` is generated by the
router plugin on `dev` and `build`; commit it when routes change.

Architecture lives in [docs/architecture](docs/architecture/README.md).

To drive your local instance from an AI agent while you work, register its MCP server:
`claude mcp add mailsink --env MAILSINK_URL=http://localhost:3000 --env
MAILSINK_KEY=mskw_... -- npx -y @devitek/mailsink-cli mcp` uses the published CLI; to test
CLI changes, run `node packages/cli/dist/bin.mjs mcp` after `pnpm build` instead. Other
clients: [docs/guides/mcp.md](docs/guides/mcp.md).

### Docker image

`docker/Dockerfile` builds from the repository root. `base` installs pnpm with npm at the
exact version of `packageManager` in package.json (no corepack, which Node 25+ no longer
bundles); then `deps` (pnpm store, keyed on the lockfile), `build` (`pnpm build`, then `pnpm deploy` of the CLI with its
external dependencies) and `runtime` (`node:24-slim`, uid 1001, Nitro `.output/` plus the
CLI as `mailsink` on the `PATH`). `.dockerignore` keeps local `node_modules`, builds and
data out of the context. The `docker` workflow builds the image with Buildx, layers cached
in the GitHub Actions cache, and runs `docker/smoke-test.sh` on both Compose profiles; run
it locally the same way:

```sh
docker build -f docker/Dockerfile -t mailsink:local .
docker/smoke-test.sh pglite postgres
```

It publishes host ports 3000 and 1025 unless `MAILSINK_HTTP_PORT` and
`MAILSINK_SMTP_HOST_PORT` say otherwise.

## Releasing

Releases are cut by [release-please](https://github.com/googleapis/release-please) from
the Conventional Commits on `main` (French descriptions are fine, the types stay English).

1. Every push to `main` opens or updates the release PR `chore(main): release X.Y.Z`. It
   bumps `version` in the root `package.json` (the server version, read by the app and
   the MCP server), in the `package.json` of every npm package (`extra-files`) and in
   `.release-please-manifest.json`, and prepends the release notes to `CHANGELOG.md`.
   `feat` bumps the minor version and `fix` the patch while the version is below 1.0.0;
   a breaking change (`!` or `BREAKING CHANGE:`) also bumps the minor.
2. Merging the release PR tags `vX.Y.Z` and creates the GitHub release, then three jobs
   of the `release-please` workflow run:
   - `image` (`release-image` workflow): `ghcr.io/devitek/mailsink` for `linux/amd64`
     and `linux/arm64`, tagged `X.Y.Z`, `X.Y` and `latest`, with provenance and SBOM
     attestations;
   - `npm` (`release-npm` workflow): every public `@devitek/*` package of `packages/*`,
     dependencies first, with npm provenance; versions already on npm are skipped;
   - `openapi` (`release-openapi` workflow): `openapi.json` (`pnpm openapi`) attached to
     the GitHub release.
3. Nothing is published before that merge. To publish an existing tag again, run
   `release-image`, `release-npm` or `release-openapi` by hand with the tag (`v0.2.0`).

Configuration: `release-please-config.json` and `.release-please-manifest.json`. Never
edit the version, the manifest or `CHANGELOG.md` by hand outside the release PR.

### npm packages

A package is published when its `packages/*/package.json` is not private and is named
`@devitek/*` (`.github/scripts/public-packages.mjs`): a new package joins the release
without editing the workflows, but its `package.json` must be added to `extra-files` in
`release-please-config.json`, since the CI rejects a version different from the server.
It needs `publishConfig.access: public`, `license: MIT`, `repository.url`
`git+https://github.com/Devitek/mailsink.git` (npm checks it for provenance) and a
`README.md`; the root `LICENSE` is copied in at pack time. The CI `packages` job builds,
packs and checks every public package exactly as the release does:

```sh
.github/scripts/pack-public.sh /tmp/mailsink-packs   # build, pnpm pack, checks
npm publish --dry-run --provenance=false /tmp/mailsink-packs/devitek-mailsink-*.tgz
```

`release-npm` authenticates with npm trusted publishing (OIDC, no secret), and falls back
to the `NPM_TOKEN` repository secret when it is set. One-time setup on npmjs.com, by an
owner of the `@devitek` npm organization:

1. The `@devitek` organization (or user scope) exists on npm.
2. First publish of a new package: a trusted publisher can only be added once the package
   exists, so create a granular access token (read and write on the `@devitek` scope,
   allowed to bypass 2FA, short expiry) and save it as the `NPM_TOKEN` secret of the
   repository before the release (or run `release-npm` by hand for an existing tag).
3. In the settings of each package, add two trusted publishers (GitHub Actions,
   organization `Devitek`, repository `mailsink`, no environment): workflow
   `release-please.yml` (releases: npm checks the calling workflow) and workflow
   `release-npm.yml` (manual runs).
4. Then delete the `NPM_TOKEN` secret, revoke the token and set each package to
   « Require two-factor authentication and disallow tokens ».

## Translations

The web UI ships in English and French, with [Lingui](https://lingui.dev). Fixing a
translation or adding a language is a great first contribution: see
[docs/contributing/translations.md](docs/contributing/translations.md).

## Security

Do not open a public issue for a vulnerability. Use GitHub private vulnerability
reporting on this repository.

## End-to-end tests

Browser scenarios live in `apps/mailsink/tests/e2e` ([Playwright](https://playwright.dev),
Chromium only); `tests/e2e/recipe` follows the user recipe of
[docs/guides/e2e.md](docs/guides/e2e.md). They run against the production build, never
`vite dev`:

```sh
pnpm build
pnpm --filter @mailsink/app exec playwright install --with-deps chromium   # once
pnpm test:e2e
```

Each run serves `node .output/server/index.mjs` on HTTP port 3506 and SMTP port 2906
(`E2E_HTTP_PORT` and `E2E_SMTP_PORT` override them), on a throwaway PGlite directory
deleted when the server stops. In CI the `e2e` job serves the build of the `check` job,
shared as the `app-output` artifact. A second suite, `tests/e2e/fallback`, builds the app
again with a test-only, partially translated `de` locale (patched at build time, never
shipped) to check the per-message English fallback of community locales; its build goes to
`tests/e2e/fallback/.output`. That build's copy of the EN catalog translates the tagline
with a test-only text (`tests/e2e/fallback/messages.ts`): the shipped EN catalog repeats
its msgids, so only this override tells a fallback on the EN catalog from a fallback on the
source text.

Reports and traces land in `apps/mailsink/playwright-report/` and `test-results/` (CI
uploads them when the job fails). On distributions where Playwright cannot install system
libraries (NixOS for instance), run the suites in the official image of the same version:

```sh
docker run --rm --network host --ipc host -v "$PWD:$PWD" -w "$PWD/apps/mailsink" \
  mcr.microsoft.com/playwright:v1.65.1-noble npm run test:e2e
```

The image has no pnpm; `npm run` only reads the script and puts the local binaries on the
`PATH`. Rootless Docker writes the artifacts as your user; with rootful Docker, add
`-u "$(id -u):$(id -g)"`.

Select elements by role and accessible text, not by layout or CSS classes: pages are
redesigned without breaking the scenarios.
Navigate with `gotoHydrated(page, url)` (`tests/e2e/goto-hydrated.ts`), not `page.goto`, in
every scenario that runs JavaScript: it waits for `<html data-hydrated>`, set once React
owns the page, so a click never lands on the inert server HTML. UI scenarios that need a
workspace of their own create it through the SDK (`tests/e2e/workspace-api.ts`).
