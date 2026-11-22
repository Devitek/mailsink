<p align="center">
  <img src=".github/assets/mailsink-mark.svg" alt="" width="116" height="116">
</p>

<h1 align="center">mailsink</h1>

<p align="center">Every email caught. None delivered. The sandbox for your transactional email.</p>

<p align="center">
  <a href="https://github.com/Devitek/mailsink/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Devitek/mailsink/ci.yml?branch=main&style=flat-square&label=ci&labelColor=141517" alt="ci"></a>
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

Planned for the first release: a single Docker image, with embedded PGlite storage by
default and PostgreSQL as an option.

```sh
docker compose up
```

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
- [Design deliveries and brand](docs/design/README.md)
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
