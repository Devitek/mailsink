# syntax=docker/dockerfile:1
# Mailsink image (#18): build from the repository root,
#   docker build -f docker/Dockerfile -t mailsink .
# Stages: deps (pnpm store), build (app + CLI), runtime (node:24-slim, non-root).

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
ENV PATH=$PNPM_HOME:$PATH
# pnpm at the version pinned by `packageManager` in package.json (Node 24 ships corepack).
RUN corepack enable
WORKDIR /repo

# Dependencies: the pnpm store (in $PNPM_HOME/store, kept in this layer rather than in a
# cache mount so a cached layer always comes with its store) only depends on the lockfile,
# so source edits keep this layer.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm fetch --frozen-lockfile

# Build: the app (Nitro output, self-contained with its traced node_modules) and the CLI.
FROM deps AS build
COPY . .
RUN pnpm install --offline --frozen-lockfile && pnpm build
# The CLI bin keeps drizzle-orm, pg and PGlite external (packages/cli/tsdown.config.ts):
# deploy it with its production dependencies installed next to dist/.
RUN pnpm --filter @mailsink/cli deploy --prod --offline /deploy/cli

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
