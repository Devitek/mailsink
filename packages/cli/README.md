# @devitek/mailsink-cli

Command line for [Mailsink](https://github.com/Devitek/mailsink), the email sink for staging
and CI: create an ephemeral workspace, wait for an email, simulate bounces and purge, from a
shell script or a CI pipeline, without writing HTTP calls.

- Built on the TypeScript SDK [`@devitek/mailsink`](https://www.npmjs.com/package/@devitek/mailsink).
- Versioned with the Mailsink server: `x.y.z` matches server `x.y.z`.

## Install

```sh
npx @devitek/mailsink-cli --help
```

Node 20+. The piloting commands need no database driver. `mailsink migrate` needs
`drizzle-orm`, `pg` and `@electric-sql/pglite` (optional peer dependencies): run it from the
Mailsink Docker image, where they are installed.

## Usage

```sh
export MAILSINK_URL=http://localhost:3000 MAILSINK_ADMIN_KEY=change-me

# An ephemeral workspace with a Resend connection; credentials printed as .env lines
npx @devitek/mailsink-cli workspace create --ephemeral --ttl 1h --connection resend:app >> .env

# Wait for an email (exit code 3 on timeout), print it as JSON
npx @devitek/mailsink-cli wait --to jane@example.com --subject Welcome --timeout 10s --json

# Every recipient matching *+bounce@* hard bounces, then back to the defaults
npx @devitek/mailsink-cli override set --rule '*+bounce@*=hard_bounce'
npx @devitek/mailsink-cli override reset
```

| Command | Purpose |
|---|---|
| `workspace create \| list \| delete` | Manage workspaces (Admin key) |
| `wait` | Wait for a matching email |
| `override set \| reset` | Temporary simulation settings |
| `purge` | Delete the captured messages |
| `mcp` | MCP server over stdio, proxied to the instance |
| `migrate` | Apply the database migrations |

Settings come from flags or from `MAILSINK_URL`, `MAILSINK_ADMIN_KEY`, `MAILSINK_KEY` and
`MAILSINK_WORKSPACE`. Exit codes: `0` success, `1` failure, `2` invalid command line, `3`
`wait` timed out.

Full guide: [docs/guides/cli.md](https://github.com/Devitek/mailsink/blob/main/docs/guides/cli.md).

## License

MIT
