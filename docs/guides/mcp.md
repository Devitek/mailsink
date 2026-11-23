# Driving Mailsink from an AI agent (MCP)

Mailsink exposes an [MCP](https://modelcontextprotocol.io) server so an agent (Claude Code,
Claude Desktop, Cursor, any MCP client) can read the emails your application sends, wait for
one, simulate opens, clicks and bounces, and change the simulated outcomes. Every tool works
on one workspace: the one of the key you give the client.

Two transports, same tools:

- **Streamable HTTP** at `<MAILSINK_PUBLIC_URL>/mcp` (stateless, no session). Use it when the
  client supports remote HTTP servers with headers.
- **stdio** with `mailsink mcp`, a thin proxy to the HTTP endpoint (D14): for clients that
  only start local commands. It needs no database access, only the URL and the key.

## 1. Pick a key

| Key | Use |
| --- | --- |
| `mskw_…` workspace key | Recommended: every connection of the workspace, SMTP-only workspaces included |
| `msk_…` connection key | Works too, still scoped to the whole workspace |
| Admin key + `X-Mailsink-Workspace: <id or slug>` | Operators: any workspace, one at a time |

The workspace key is returned once, when the workspace is created (`POST /admin/workspaces`,
field `workspaceKey`), and the response also gives `urls.mcp`, the endpoint to use. Every
MCP call counts as activity: it extends the idle TTL of an ephemeral workspace.

## 2. Configure the client

The examples use `http://localhost:3000`; replace it with your `MAILSINK_PUBLIC_URL`.

### Claude Code

HTTP:

```sh
claude mcp add --transport http mailsink http://localhost:3000/mcp \
  --header "Authorization: Bearer mskw_..."
```

stdio (from a checkout after `pnpm build`, or anywhere the `mailsink` bin is installed):

```sh
claude mcp add mailsink \
  --env MAILSINK_URL=http://localhost:3000 --env MAILSINK_KEY=mskw_... \
  -- node /path/to/mailsink/packages/cli/dist/bin.mjs mcp
```

Or commit a project-scoped `.mcp.json` that reads the key from the environment:

```json
{
  "mcpServers": {
    "mailsink": {
      "type": "http",
      "url": "http://localhost:3000/mcp",
      "headers": { "Authorization": "Bearer ${MAILSINK_KEY}" }
    }
  }
}
```

### Claude Desktop

Claude Desktop starts local servers over stdio. In `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mailsink": {
      "command": "node",
      "args": ["/path/to/mailsink/packages/cli/dist/bin.mjs", "mcp"],
      "env": { "MAILSINK_URL": "http://localhost:3000", "MAILSINK_KEY": "mskw_..." }
    }
  }
}
```

With the Docker image instead of a checkout (the image ships the `mailsink` bin):

```json
{
  "mcpServers": {
    "mailsink": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i", "--network", "host",
        "-e", "MAILSINK_URL", "-e", "MAILSINK_KEY",
        "mailsink:local", "mailsink", "mcp"
      ],
      "env": { "MAILSINK_URL": "http://localhost:3000", "MAILSINK_KEY": "mskw_..." }
    }
  }
}
```

### Cursor

`.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global), HTTP:

```json
{
  "mcpServers": {
    "mailsink": {
      "url": "http://localhost:3000/mcp",
      "headers": { "Authorization": "Bearer mskw_..." }
    }
  }
}
```

or stdio:

```json
{
  "mcpServers": {
    "mailsink": {
      "command": "node",
      "args": ["/path/to/mailsink/packages/cli/dist/bin.mjs", "mcp"],
      "env": { "MAILSINK_URL": "http://localhost:3000", "MAILSINK_KEY": "mskw_..." }
    }
  }
}
```

### `mailsink mcp` options

| Option | Environment | Default |
| --- | --- | --- |
| `--url` | `MAILSINK_URL` | `http://localhost:3000` (`/mcp` is appended unless already there) |
| `--key` | `MAILSINK_KEY` | required |
| `--workspace` | `MAILSINK_WORKSPACE` | none; id or slug, with the Admin key only |

stdout carries the protocol only; connection problems are written to stderr, and a request
the endpoint refuses (wrong key: `unauthorized`) is answered with a JSON-RPC error that
quotes the Mailsink error body. The key is never printed.

## 3. Tools

Arguments mirror the Capture API (doc 03, « Capture » and « MCP »); answers are the same JSON
as the HTTP routes, as text and as structured content. A failure is a tool error whose text
is the HTTP error body, for example `{"error":{"code":"wait_timeout","message":"…"}}`.

| Tool | What it does | HTTP twin |
| --- | --- | --- |
| `list_emails` | Search captured emails (to, from, subject, tag, status, connectionId, since, until, q, cursor) | `GET /capture/messages` |
| `get_email` | One email in full: bodies, headers, links, attachments, recipients, events, webhooks; `rawUrl` and `downloadUrl` are absolute | `GET /capture/messages/:id` |
| `get_email_source` | The raw MIME source (EML) as an embedded `message/rfc822` resource | `GET /capture/messages/:id/raw` |
| `get_email_attachment` | One attachment (`attachmentId` from `get_email`): text types as text, others base64 | `GET /capture/messages/:id/attachments/:attId` |
| `wait_for_email` | Wait (default and max 30 s) until an email matches, then the first page | `GET /capture/messages?wait=true` |
| `trigger_email_event` | Opened, clicked or a forced status, origin `mcp` | `POST /capture/messages/:id/events` |
| `set_override_config` | Force status rates, rules, latency, chaos or rate limit, optional TTL | `POST /capture/override` |
| `reset_override_config` | Back to the configured settings (idempotent) | `POST /capture/override/reset` |
| `get_override_config` | Active overrides and effective settings per connection | `GET /capture/override` |
| `purge_emails` | Delete emails (and their request logs unless `includeLogs: false`) | `DELETE /capture/messages` |
| `get_delivery_logs` | API request log (`source: "api"`) or SMTP sessions (`source: "smtp"`), one entry with `id` | `GET /capture/logs/…` |
| `get_webhook_deliveries` | Webhook delivery log, one delivery with its attempts with `id` | `GET /capture/webhooks/deliveries…` |
| `list_suppressions` | Suppressed recipients (hard bounces, complaints, manual) | `GET /capture/suppressions` |

A typical agent session: trigger the email in the application, `wait_for_email` with
`{ "to": "jane@example.com", "subject": "Reset" }`, then `get_email` to read the link, and
`trigger_email_event` with `{ "id": "msg_…", "event": { "type": "clicked", "url": "…" } }`
to see what the application does with the webhook.

## 4. Behaviour worth knowing

- **Stateless.** Each `POST /mcp` builds a fresh server: no `Mcp-Session-Id`, any instance
  behind a load balancer can answer. `GET` and `DELETE /mcp` answer `405` (no standalone
  stream, no session to end), which MCP clients handle.
- **Logged and counted.** Every call writes one request log row with dialect `mcp` (see
  `get_delivery_logs`) and touches the workspace activity, like the Capture API.
- **Workspace deletion.** When the workspace is deleted (Admin API or idle TTL), a pending
  `wait_for_email` answers `not_found` at once and any MCP response still open is closed.
- **Messages stay English** (D19), like the HTTP APIs.
