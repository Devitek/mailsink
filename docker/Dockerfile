# syntax=docker/dockerfile:1
# Mailsink image (#18): build from the repository root,
#   docker build -f docker/Dockerfile -t mailsink .
# Stages: pnpm-spec and base (pinned pnpm), deps (pnpm store), build (app + CLI),
# runtime (node:24-slim, non-root).
#
# Multi-platform builds (linux/amd64 and linux/arm64, release-image.yml): every stage but
# the runtime runs on the build platform ($BUILDPLATFORM), natively, never under QEMU. Their
# output is platform independent: the Nitro output is JavaScript plus the PGlite WASM
# assets, with no native addon traced, and the CLI deploy has no package with an `os` or
# `cpu` field (checked for #118). Only the runtime stage, a few file operations, runs on
# the target platform. A dependency that ships a native binary to the runtime would have to
# be installed in the runtime stage instead.

# The pnpm version pinned by `packageManager` in package.json (`pnpm@x.y.z`, hash suffix
# dropped), and the root manifest without its `version`. BuildKit keys the COPY --from below
# on these files' content, so editing package.json elsewhere (scripts...) keeps the pnpm
# layer cached, and a release bump of `version` keeps the deps layer cached (#106).
FROM --platform=$BUILDPLATFORM node:24-slim AS pnpm-spec
COPY package.json /tmp/package.json
RUN node -e "const fs = require('fs'); const pkg = require('/tmp/package.json'); \
      const s = pkg.packageManager.split('+')[0]; \
      if (!/^pnpm@\d+\.\d+\.\d+$/.test(s)) throw new Error('packageManager: ' + s); \
      fs.writeFileSync('/pnpm-spec', s); delete pkg.version; \
      fs.mkdirSync('/manifest'); \
      fs.writeFileSync('/manifest/package.json', JSON.stringify(pkg, null, 2) + '\\n')"

# pnpm installed with npm (shipped with every Node image) rather than corepack, which
# Node 25+ no longer bundles.
FROM --platform=$BUILDPLATFORM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
COPY --from=pnpm-spec /pnpm-spec /pnpm-spec
RUN npm install --global --no-fund --no-audit "$(cat /pnpm-spec)" && pnpm --version
WORKDIR /repo

# Dependencies: the pnpm store (in $PNPM_HOME/store, kept in this layer rather than in a
# cache mount so a cached layer always comes with its store) only depends on the lockfile
# and the version-less root manifest, so source edits and release bumps keep this layer.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=pnpm-spec /manifest/package.json ./package.json
RUN pnpm fetch --frozen-lockfile

# Build: the app (Nitro output, self-contained with its traced node_modules) and the CLI.
# The documentation site (apps/docs, D265) is not part of the image: only its manifest is in
# the context (.dockerignore), so the workspace still matches the lockfile, and the install
# leaves it out (D273).
FROM deps AS build
COPY . .
RUN pnpm install --offline --frozen-lockfile --filter '!@mailsink/docs' && pnpm build
# The CLI bin keeps its dependencies external (packages/cli/tsdown.config.ts): deploy it
# with its production dependencies next to dist/, plus @mailsink/db for the drivers of
# `migrate` (optional peers of the npm CLI, D251). Not --offline: pnpm
# checks the deploy lockfile against its supply-chain policies, which needs registry
# metadata (publish dates) that `pnpm fetch` does not cache; the packages themselves come
# from the store filled by `pnpm fetch` (#114). Selected by folder, not by name: the CLI is
# published to npm as `@devitek/mailsink-cli` (#128).
RUN pnpm --filter ./packages/cli deploy --prod /deploy/cli \
    && pnpm --filter @mailsink/db deploy --prod /deploy/db
# Guard of the build platform stages: no native addon may reach the runtime from here.
RUN if find apps/mailsink/.output /deploy/cli /deploy/db/node_modules -name '*.node' | grep .; then \
      echo 'native addon in the build output: install it in the runtime stage' >&2; exit 1; fi

FROM node:24-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    MAILSINK_SMTP_PORT=1025 \
    DATABASE_URL=pglite:///app/data
WORKDIR /app
# Unprivileged user; /app/data is the PGlite volume (docker/docker-compose.yml).
RUN groupadd --system --gid 1001 mailsink \
    && useradd --system --uid 1001 --gid mailsink --no-create-home mailsink \
    && mkdir /app/data && chown mailsink:mailsink /app/data
COPY --from=build --chown=root:root /repo/apps/mailsink/.output ./.output
COPY --from=build --chown=root:root /deploy/cli ./packages/cli
# The database drivers of `mailsink migrate` (drizzle-orm, pg, PGlite) are optional peers
# of the npm CLI (D251); the image ships them, resolved from /app/node_modules.
COPY --from=build --chown=root:root /deploy/db/node_modules ./node_modules
RUN ln -s /app/packages/cli/dist/bin.mjs /usr/local/bin/mailsink \
    && chmod +x /app/packages/cli/dist/bin.mjs
USER mailsink
VOLUME ["/app/data"]
EXPOSE 3000 1025
# start-period: the first boot on an empty PGlite folder takes about 10 s (WASM init and
# migrations), more on a loaded host; probes failing in that window do not count.
HEALTHCHECK --interval=10s --timeout=5s --start-period=40s --start-interval=2s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", ".output/server/index.mjs"]
