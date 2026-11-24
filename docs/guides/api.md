# HTTP API reference (OpenAPI)

Mailsink describes every public HTTP route in an [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0)
document, generated from the same Zod contracts the server validates with: native ingestion
(`/v1`), the Resend and Brevo drop-ins, the Admin API, the Capture API (messages, events,
override, suppressions, webhooks, logs, demo data, stream) and the public routes. Use it to
browse the API, to generate a client in another language, or to check your own client.
The documentation website renders it as the
[API reference](https://mailsink.devitek.fr/api/), one page per operation.

## 1. Get the document

| Where | How |
| --- | --- |
| A running instance | `GET <MAILSINK_PUBLIC_URL>/openapi.json`, no credential needed |
| A release | the `openapi.json` asset of each [GitHub release](https://github.com/Devitek/mailsink/releases) |
| A checkout | `pnpm install && pnpm openapi [file]` (default `./openapi.json`) |

```sh
curl -s http://localhost:3000/openapi.json -o openapi.json
```

The instance answers with its own `MAILSINK_PUBLIC_URL` as `servers[0]`, so tools call the
right host. `pnpm openapi` uses `MAILSINK_PUBLIC_URL` when set, else
`http://localhost:3000`. `info.version` is the Mailsink release.

The endpoint holds no data and answers `Access-Control-Allow-Origin: *`, so a viewer served
from another origin can load it directly.

## 2. Authenticate

The document declares the credentials as security schemes; each operation lists the ones it
accepts.

| Scheme | Header | Routes |
| --- | --- | --- |
| `connectionKey` | `Authorization: Bearer msk_…` | Ingestion (`/v1`, `/emails`, `/v3`); the Capture API too |
| `brevoApiKey` | `api-key: msk_…` | Brevo drop-in (`POST /v3/smtp/email`) |
| `workspaceKey` | `Authorization: Bearer mskw_…` | Capture API |
| `adminKey` | `Authorization: Bearer <MAILSINK_ADMIN_KEY>` | Admin API |
| `adminKey` + `workspaceHeader` | Admin key and `X-Mailsink-Workspace: <id or slug>` | Capture API, any workspace |

Keys are answered once, when a workspace or connection is created
(`POST /admin/workspaces`, `POST /admin/workspaces/{id}/connections`).

## 3. Browse it

Swagger UI, in Docker, pointed at a running instance:

```sh
docker run --rm -p 8080:8080 -e URL=http://localhost:3000/openapi.json swaggerapi/swagger-ui
```

Open `http://localhost:8080`, then « Authorize » with the key of the scheme you need. Any
other OpenAPI 3.1 tool works the same way, for example a static HTML page with Redocly:

```sh
npx @redocly/cli build-docs openapi.json -o mailsink-api.html
```

## 4. Generate a client

Any OpenAPI 3.1 generator can read the document. Operations have stable `operationId`s
(`sendEmail`, `listMessages`, `getMessage`…) and are grouped by tags (`Native ingestion`,
`Admin`, `Capture: messages`…).

```sh
# TypeScript types
npx openapi-typescript openapi.json -o mailsink.d.ts

# A Python client
docker run --rm -v "$PWD:/local" openapitools/openapi-generator-cli generate \
  -i /local/openapi.json -g python -o /local/mailsink-client
```

For the Resend and Brevo routes, prefer the official SDKs pointed at Mailsink: those routes
are documented for completeness and answer in the provider's shapes.

## 5. What the document tells you

- **Errors**: native, Capture and Admin routes answer `{ error: { code, message, details? },
  requestId }` (`ApiErrorBody`); the Resend and Brevo routes answer in their provider
  shapes (`ResendErrorBody`, `BrevoError`). Each operation lists its error statuses with
  the codes behind them (`401` `unauthorized`, `422` `validation_error`, `429`
  `rate_limited`…).
- **Headers**: every response carries `X-Request-Id` (the id of its request log row).
  Ingestion responses carry `X-RateLimit-Limit`, `X-RateLimit-Remaining` and
  `X-RateLimit-Reset` while a rate limit applies, `Retry-After` on `429`, and
  `Idempotent-Replayed: true` when replayed for the same `Idempotency-Key`.
- **Stream**: `GET /capture/stream` is Server-Sent Events (`text/event-stream`); the `data:`
  of each frame is one `StreamEvent` JSON (`components.schemas.StreamEvent`).
- **Outgoing webhooks**: the payloads Mailsink POSTs to your webhook endpoints, per format
  (`unified`, `resend`, `brevo`), are in the document's `webhooks` section.
- **Not in the document**: the MCP endpoint (`/mcp`, see [mcp.md](mcp.md)) and the routes
  of the web UI behind its session cookie.
