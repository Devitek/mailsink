<p align="center">
  <img src=".github/assets/banner.svg" alt="mailsink" width="100%">
</p>

<p align="center">Self-hosted email sink for E2E tests and staging, Resend/Brevo/SMTP drop-in.</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/Devitek/mailsink?style=flat-square&labelColor=141517&color=F6F5F2" alt="license"></a>
</p>

<p align="center">
  <a href="#installation">Installation</a> ·
  <a href="#usage">Usage</a> ·
  <a href="#documentation">Documentation</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

Mailsink captures transactional email instead of delivering it. Point your app's
[Resend](https://resend.com) or [Brevo](https://www.brevo.com) SDK, or any SMTP client such
as [Nodemailer](https://nodemailer.com), at Mailsink with only a base URL or host change.
CI runs create isolated, self-expiring workspaces per test worker, force bounces,
latency or rate limits, and assert on what was sent through an HTTP API or MCP. Staging
teams get persistent workspaces and a web UI to inspect rendered emails, SMTP sessions,
API calls and signed webhooks.

> [!IMPORTANT]
> Mailsink is in its design phase: nothing is runnable yet. The architecture and roadmap
> are in [docs/architecture](docs/architecture/README.md).

## Installation

Mailsink ships as a single Docker image: HTTP on port 3000 (web UI, provider APIs,
Capture API, `/healthz`) and SMTP on port 1025. Storage is embedded PGlite by default,
PostgreSQL as an option. No published image yet: build it from a clone.

```sh
git clone https://github.com/Devitek/mailsink.git && cd mailsink
export MAILSINK_ADMIN_KEY=change-me   # unset, the Admin API refuses every call

# Embedded PGlite, data in the `pglite-data` volume
docker compose -f docker/docker-compose.yml --profile pglite up -d --build

# Or PostgreSQL 18, data in the `postgres-data` volume
docker compose -f docker/docker-compose.yml --profile postgres up -d --build

curl http://localhost:3000/healthz   # {"status":"ok",...} once the container is healthy
```

Host ports are set with `MAILSINK_HTTP_PORT` and `MAILSINK_SMTP_HOST_PORT`, the Postgres
password with `POSTGRES_PASSWORD`. Migrations run at every boot; the first boot on an empty
PGlite volume takes about 10 seconds. The `mailsink` CLI is available in the image, for
example `docker compose -f docker/docker-compose.yml --profile postgres exec
mailsink-postgres mailsink migrate`.

Without Compose:

```sh
docker build -f docker/Dockerfile -t mailsink:local .
docker run -d -p 3000:3000 -p 1025:1025 -v mailsink-data:/app/data \
  -e MAILSINK_ADMIN_KEY=change-me mailsink:local
```

The container runs as an unprivileged user (uid 1001): a bind mount used as `/app/data`
must be writable by that uid.

## Usage

**Provision an ephemeral workspace for a CI run**

```sh
curl -X POST http://localhost:3000/admin/workspaces \
  -H "Authorization: Bearer $MAILSINK_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"ci-run-42","ephemeral":true,"connections":[{"kind":"resend","name":"app"}]}'
```

**Send with the Resend SDK, unchanged**

```ts
const resend = new Resend(process.env.RESEND_API_KEY) // msk_… from the response above
// RESEND_BASE_URL=http://localhost:3000
```

**Wait for the email in a test**

```sh
curl "http://localhost:3000/capture/messages?to=jane@example.com&wait=true&timeout=5000" \
  -H "Authorization: Bearer $MAILSINK_KEY"
```

## Features

- Workspaces: persistent for staging, ephemeral with an idle TTL for CI.
- Connections per workspace: `resend`, `brevo`, `smtp`, each with its own credentials.
- Simulation: status rates, deterministic per-recipient rules, latency, chaos errors,
  rate limits, temporary overrides with reset, automatic suppression list.
- Webhooks signed with HMAC-SHA256 and Svix-compatible headers, retries and replay.
- Capture API, SSE stream and an MCP server for AI agents.
- Web UI in English and French.

## Documentation

- [Architecture overview and decision log](docs/architecture/README.md)
- [Project tree](docs/architecture/01-project-tree.md) ·
  [Database schema](docs/architecture/02-database-schema.md) ·
  [Contracts](docs/architecture/03-contracts.md) ·
  [Sequence](docs/architecture/04-sequence.md) ·
  [Roadmap](docs/architecture/05-roadmap.md)
- [Translating the web UI](docs/contributing/translations.md)

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first: one issue per change, Conventional Commits, green CI.

## License

Mailsink is released under the [MIT License](LICENSE).

---

<p align="center">
  <a href="https://github.com/Devitek">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset=".github/assets/devitek-wordmark-blanc.svg">
      <img src=".github/assets/devitek-wordmark-encre.svg" alt="Devitek" height="22">
    </picture>
  </a>
  <br>
  <sub>Built and maintained by <a href="https://github.com/Devitek">Devitek</a></sub>
</p>
