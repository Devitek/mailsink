<p align="center">
  <img src=".github/assets/mailsink-mark.svg" alt="" width="116" height="116">
</p>

<h1 align="center">mailsink</h1>

<p align="center">Every email caught. None delivered. The sandbox for your transactional email.</p>

<p align="center">
  <a href="https://github.com/Devitek/mailsink/releases/latest"><img src="https://img.shields.io/github/v/release/Devitek/mailsink?style=flat-square&label=release&labelColor=141517&color=F0703A" alt="release"></a>
  <a href="https://github.com/Devitek/mailsink/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Devitek/mailsink/ci.yml?branch=main&style=flat-square&label=ci&labelColor=141517" alt="ci"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/Devitek/mailsink?style=flat-square&labelColor=141517&color=F6F5F2" alt="license"></a>
</p>

<p align="center">
  <a href="#installation">Installation</a> ·
  <a href="#usage">Usage</a> ·
  <a href="#documentation">Documentation</a> ·
  <a href="CHANGELOG.md">Changelog</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

Mailsink captures transactional email instead of delivering it. Point your app's
[Resend](https://resend.com) or [Brevo](https://www.brevo.com) SDK, or any SMTP client such
as [Nodemailer](https://nodemailer.com), at Mailsink with only a base URL or host change.
CI runs create isolated, self-expiring workspaces per test worker, force bounces,
latency or rate limits, and assert on what was sent through an HTTP API or MCP. Staging
teams get persistent workspaces and a web UI to inspect rendered emails, SMTP sessions,
API calls and signed webhooks.

## Installation

Mailsink ships as one Docker image, `ghcr.io/devitek/mailsink` (`linux/amd64` and
`linux/arm64`): HTTP on port 3000 (web UI, provider APIs, Capture API, MCP, `/healthz`)
and SMTP on port 1025. Storage is embedded PGlite by default, PostgreSQL as an option.
Docker with Compose v2 is the only requirement.

```sh
curl -fsSLO \
  https://raw.githubusercontent.com/Devitek/mailsink/main/docker/docker-compose.yml
export MAILSINK_ADMIN_KEY=change-me   # unset, the Admin API and the web UI refuse access

# Embedded PGlite, data in the `pglite-data` volume
docker compose --profile pglite up -d

# Or PostgreSQL 18, data in the `postgres-data` volume
docker compose --profile postgres up -d

curl http://localhost:3000/healthz   # {"status":"ok",...} once the container is healthy
```

The Compose file runs `ghcr.io/devitek/mailsink:latest`; set `MAILSINK_IMAGE` to pin a
release (`ghcr.io/devitek/mailsink:0.1` or `:0.1.0`). Host ports are set with
`MAILSINK_HTTP_PORT` and `MAILSINK_SMTP_HOST_PORT`, the Postgres password with
`POSTGRES_PASSWORD`. Migrations run at every boot; the first boot on an empty PGlite volume
takes about 10 seconds. The `mailsink` CLI is in the image, for example
`docker compose --profile postgres exec mailsink-postgres mailsink migrate`.

STARTTLS on SMTP is optional: put the PEM certificate and key in a host directory readable
by uid 1001, then set `MAILSINK_SMTP_TLS_DIR` (mounted read-only on `/app/tls`, relative
to the Compose file), `MAILSINK_SMTP_TLS_CERT=/app/tls/cert.pem` and
`MAILSINK_SMTP_TLS_KEY=/app/tls/key.pem`.

**Without Compose**

```sh
docker run -d -p 3000:3000 -p 1025:1025 -v mailsink-data:/app/data \
  -e MAILSINK_ADMIN_KEY=change-me ghcr.io/devitek/mailsink:latest
```

The container runs as an unprivileged user (uid 1001): a bind mount used as `/app/data`
must be writable by that uid.

**From a clone**, to run your own build:

```sh
git clone https://github.com/Devitek/mailsink.git && cd mailsink
MAILSINK_IMAGE=mailsink:local docker compose -f docker/docker-compose.yml \
  --profile pglite up -d --build
```

## Usage

Open http://localhost:3000 and sign in with the admin key to browse workspaces, rendered
emails and logs. Tests and CI drive the same data over HTTP.

**Provision an ephemeral workspace for a CI run**

```sh
curl -X POST http://localhost:3000/admin/workspaces \
  -H "Authorization: Bearer $MAILSINK_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"ci-42","ephemeral":true,"connections":[{"kind":"resend","name":"app"}]}'
```

The response holds the secrets once: `workspaceKey` (`mskw_…`, for the Capture API) and,
per connection, its credentials and an `.env` snippet.

**Send with the Resend SDK, unchanged**

```sh
RESEND_API_KEY=msk_…                    # connections[0].credentials.apiKey
RESEND_BASE_URL=http://localhost:3000   # read by the SDK
```

```ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
await resend.emails.send({
  from: 'Acme <hello@app.test>',
  to: 'jane@example.com',
  subject: 'Welcome',
  html: '<p>Hi</p>',
})
```

Brevo connections work the same way with the Brevo SDK, `smtp` connections with any SMTP
client such as Nodemailer on port 1025.

**Wait for the email in a test**

```sh
since=$(date -u +%Y-%m-%dT%H:%M:%SZ)   # taken before the app sends
# ...the app sends the email
curl -G http://localhost:3000/capture/messages \
  -H "Authorization: Bearer $MAILSINK_WORKSPACE_KEY" \
  -d to=jane@example.com -d since="$since" -d wait=true -d timeout=10000
```

The call answers as soon as a message matches, or `408` after the timeout. The
[E2E testing guide](docs/guides/e2e.md) gives the full recipe: one ephemeral workspace per
test worker, reset between tests, forced bounces through overrides. The
[MCP guide](docs/guides/mcp.md) connects Claude Code, Claude Desktop or Cursor to a
workspace.

## Features

- Workspaces: persistent for staging, ephemeral with an idle TTL for CI.
- Connections per workspace: `resend`, `brevo`, `smtp`, each with its own credentials.
- Simulation: status rates, deterministic per-recipient rules, latency, chaos errors,
  rate limits, temporary overrides with reset, automatic suppression list.
- Webhooks signed with HMAC-SHA256 and Svix-compatible headers, retries and replay.
- Capture API, SSE stream and an MCP server for AI agents (HTTP and stdio, see the
  [MCP guide](docs/guides/mcp.md)).
- Web UI in English and French.

## Documentation

- [Architecture overview and decision log](docs/architecture/README.md)
- [Project tree](docs/architecture/01-project-tree.md) ·
  [Database schema](docs/architecture/02-database-schema.md) ·
  [Contracts](docs/architecture/03-contracts.md) ·
  [Sequence](docs/architecture/04-sequence.md) ·
  [Roadmap](docs/architecture/05-roadmap.md)
- [Design deliveries and brand](docs/design/README.md)
- [Testing your app with Mailsink (E2E guide)](docs/guides/e2e.md)
- [Driving Mailsink from an AI agent (MCP guide)](docs/guides/mcp.md)
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
