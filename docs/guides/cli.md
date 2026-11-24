# Command line (`mailsink`, `@devitek/mailsink-cli`)

`mailsink` drives a Mailsink instance from a shell script or a CI pipeline, without writing
HTTP calls: create an ephemeral workspace, wait for an email, simulate bounces, purge. It
also runs the server-side tasks `migrate` and `mcp`. Contract: `03-contracts.md`, section
« CLI ». Decisions: D250 to D254.

## Install

- **npx**: `npx @devitek/mailsink-cli <command>` (Node 20+). The package installs only
  `zod` and the MCP client: the piloting commands never need a database driver (D251).
- **Docker image**: `mailsink` is on the `PATH` of the server image, `migrate` included:
  `docker compose exec mailsink mailsink migrate`.
- **Monorepo**: `pnpm --filter @devitek/mailsink-cli build`, then
  `node packages/cli/dist/bin.mjs <command>`.

`mailsink migrate` needs `drizzle-orm`, `pg` and `@electric-sql/pglite` (optional peer
dependencies). Through npx it stops with a message naming the missing package: run it from
the image, or install the three packages next to the CLI.

## Settings

Every piloting command reads its settings from a flag, else from the environment. Prefer
the environment for keys: flags show in process lists.

| Flag | Variable | Meaning |
|---|---|---|
| `--url` | `MAILSINK_URL` | Base URL of the instance, default `http://localhost:3000` |
| `--admin-key` | `MAILSINK_ADMIN_KEY` | Admin key, for `workspace` commands |
| `--key` | `MAILSINK_KEY` | Workspace key (`mskw_`) or connection key (`msk_`), for `wait`, `override`, `purge` |
| `--workspace` | `MAILSINK_WORKSPACE` | Workspace id or slug, with the Admin key instead of `MAILSINK_KEY` |
| `--json` | | Print the API answer as JSON instead of the human output |

Exit codes: `0` success, `1` failure (API error, network, refused key), `2` invalid command
line (unknown option, invalid value, missing credential), `3` `mailsink wait` timed out.
Errors are printed on stderr, as `<code>: <message> (request <id>)` for API errors.

## Commands

### `workspace create`

```sh
mailsink workspace create --ephemeral --ttl 1h --connection resend:app
```

```
MAILSINK_URL=http://localhost:3000
MAILSINK_WORKSPACE_ID=ws_...
MAILSINK_WORKSPACE_SLUG=mailsink-cli-x7k2p9
MAILSINK_KEY=mskw_...
RESEND_API_KEY=msk_...
RESEND_BASE_URL=http://localhost:3000
```

The credentials are shown once, as `.env` lines: append them to `$GITHUB_ENV` or to a
`.env` file, the next commands read `MAILSINK_URL` and `MAILSINK_KEY`. Options: `--ephemeral`
(deleted after `--ttl` of inactivity, server default otherwise), `--name` (default
`mailsink-cli`), `--slug`, `--retention 7d`, `--connection <kind>[:<name>]` (kind `resend`,
`brevo` or `smtp`; repeat it for several connections; two connections of one kind print
the same variable names). `--json` prints the whole answer, connection credentials
included.

### `workspace list` and `workspace delete`

```sh
mailsink workspace list --ephemeral          # ephemeral workspaces included
mailsink workspace delete "$MAILSINK_WORKSPACE_ID"
```

`delete` takes one or more ids or slugs and removes their messages, logs and keys at once.

### `wait`

```sh
mailsink wait --to jane@example.com --subject "Confirm" --timeout 30s
LINK=$(mailsink wait --to jane@example.com --link /verify)
mailsink wait --to jane@example.com --json | jq -r '.extractedLinks[0]'
```

Long polls until a message matches, then prints it (id, date, from, to, subject, status,
links). Filters: `--to`, `--from`, `--subject` (substrings), `--tag name[:value]`, `--q`
(full text), `--connection <id>`. `--timeout`: `500ms`, `5s`, `2m`, a bare number is
seconds, default `10s`; the exit code is `3` when nothing matched in time.

`--since` sets the oldest message that counts: an ISO date, `now`, or a duration ago
(`5m`). By default any message already stored counts, because a script usually runs the
action before `mailsink wait`. To wait for a second email to the same address, take the
time before the action: `SINCE=$(date -u +%Y-%m-%dT%H:%M:%SZ)`, then `--since "$SINCE"`.
When several messages match, the first one that arrived wins.

`--link <substring>` prints only the first link of the message containing it (exit `1`
when none does). `--json` prints the full message detail plus `extractedLinks` (links of
the HTML and text bodies) and `link`.

### `override set` and `override reset`

```sh
mailsink override set --hard-bounce 20 --latency 100-500 --ttl 10m
mailsink override set --rule '*+bounce@*=hard_bounce' --rule '*@slow.test=deferred'
mailsink override reset
```

Rates are percentages of the messages: `--delivered`, `--deferred`, `--soft-bounce`,
`--hard-bounce`, `--complained`, `--failed`, `--invalid`. `--latency <min>-<max>` (ms, or one value),
`--error-rate` (requests refused before ingestion), `--rule '<glob>=<status>'` (repeats).
`--config '<json>'` sets any other `OverrideConfig` field; the flags are merged over it.
`--ttl` resets the override automatically, `--connection <id>` limits it to one
connection.

### `purge`

```sh
mailsink purge                        # every message of the workspace, with its logs
mailsink purge --before 2026-01-01T00:00:00Z --keep-logs
```

## CI example (GitHub Actions)

```yaml
env:
  MAILSINK_URL: https://mailsink.example.com
  MAILSINK_ADMIN_KEY: ${{ secrets.MAILSINK_ADMIN_KEY }}
steps:
  - run: npx @devitek/mailsink-cli workspace create --ephemeral --ttl 1h --connection resend:app >> "$GITHUB_ENV"
  - run: pnpm test:e2e # the app under test reads RESEND_API_KEY and RESEND_BASE_URL
  - run: npx @devitek/mailsink-cli wait --to signup@example.com --link /verify
  - if: always()
    run: npx @devitek/mailsink-cli workspace delete "$MAILSINK_WORKSPACE_ID"
```

The workspace credentials end up in the job environment: mask them
(`echo "::add-mask::$MAILSINK_KEY"`) if the logs are public.

## Server side

- `mailsink migrate [--database-url <url>]` applies the pending migrations (`DATABASE_URL`:
  `postgres://...`, `pglite://<dir>` or `pglite://memory`, default `pglite://./data`).
- `mailsink mcp [--url] [--key] [--workspace]` is the MCP stdio proxy: see
  [the MCP guide](mcp.md).
