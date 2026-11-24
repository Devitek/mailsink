import { DEFAULT_MAILSINK_URL } from './config'

export const USAGE = `Usage: mailsink <command> [options]

Piloting (HTTP API, for CI and shell scripts):
  mailsink workspace create [--ephemeral] [--ttl 1h] [--name <name>] [--slug <slug>]
                            [--retention 7d] [--connection <kind>[:<name>]]...
                                    Create a workspace, print its credentials as .env lines
  mailsink workspace list [--ephemeral]
                                    List the workspaces (--ephemeral: include ephemeral ones)
  mailsink workspace delete <id|slug>...
                                    Delete workspaces with their messages and logs
  mailsink wait [--to <s>] [--from <s>] [--subject <s>] [--tag <name[:value]>] [--q <text>]
                [--connection <id>] [--since <iso|now|5m>] [--timeout 10s] [--link <s>]
                                    Wait for a matching message (exit code 3 on timeout)
  mailsink override set [--hard-bounce 20] [--soft-bounce 5] [--deferred 5] [--complained 1]
                        [--failed 1] [--delivered 50] [--latency 100-500] [--error-rate 10]
                        [--rule '<glob>=<status>']... [--config <json>] [--ttl 10m]
                        [--connection <id>]
                                    Activate a simulation override (rates in %, latency in ms)
  mailsink override reset [--connection <id>]
                                    Back to the configured simulation settings
  mailsink purge [--connection <id>] [--before <iso>] [--keep-logs]
                                    Delete the captured messages

Server side:
  mailsink migrate [--database-url <url>]   Apply pending database migrations
  mailsink mcp [--url <url>] [--key <key>] [--workspace <id|slug>]
                                            MCP server on stdio, proxied to <url>/mcp
  mailsink help                             Show this help

Options of the piloting commands, each with its environment variable:
  --url <url>          MAILSINK_URL          base URL (default ${DEFAULT_MAILSINK_URL})
  --admin-key <key>    MAILSINK_ADMIN_KEY    Admin key (workspace commands)
  --key <key>          MAILSINK_KEY          workspace key (mskw_...) or connection key (msk_...)
  --workspace <ref>    MAILSINK_WORKSPACE    workspace id or slug, with the Admin key only
  --json                                     print the API answer as JSON

DATABASE_URL (migrate): postgres://..., pglite://<dir> or pglite://memory (default
pglite://./data). Prefer the environment to flags for keys: flags show in process lists.
Exit codes: 0 success, 1 failure, 2 invalid command line, 3 wait timeout.`
