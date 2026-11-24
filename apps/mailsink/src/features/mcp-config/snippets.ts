// MCP client configuration of a workspace (#43): the snippets of docs/guides/mcp.md with the
// URLs of this instance. The workspace key is shown once at creation, so the snippets carry
// a `mskw_...` placeholder (D204). stdio runs the published CLI through npx (#141).

export type McpClient = 'claude-code' | 'claude-desktop' | 'cursor'
export type McpTransport = 'http' | 'stdio'

export type McpSnippet = {
  id: string
  client: McpClient
  transport: McpTransport
  language: 'sh' | 'json'
  /** Where it goes (a file name), when it is a configuration file. */
  file?: string
  code: string
}

export const KEY_PLACEHOLDER = 'mskw_...'
const CLI = ['-y', '@devitek/mailsink-cli', 'mcp']

const json = (value: unknown) => JSON.stringify(value, null, 2)
const servers = (mailsink: unknown) => json({ mcpServers: { mailsink } })

export function mcpSnippets({
  publicUrl,
  mcpUrl,
}: {
  publicUrl: string
  mcpUrl: string
}): McpSnippet[] {
  const env = { MAILSINK_URL: publicUrl, MAILSINK_KEY: KEY_PLACEHOLDER }
  const bearer = `Bearer ${KEY_PLACEHOLDER}`
  const stdio = { command: 'npx', args: CLI, env }
  return [
    {
      id: 'claude-code-http',
      client: 'claude-code',
      transport: 'http',
      language: 'sh',
      code: `claude mcp add --transport http mailsink ${mcpUrl} \\\n  --header "Authorization: ${bearer}"`,
    },
    {
      id: 'claude-code-stdio',
      client: 'claude-code',
      transport: 'stdio',
      language: 'sh',
      code: `claude mcp add mailsink \\\n  --env MAILSINK_URL=${publicUrl} --env MAILSINK_KEY=${KEY_PLACEHOLDER} \\\n  -- npx ${CLI.join(' ')}`,
    },
    {
      id: 'claude-code-project',
      client: 'claude-code',
      transport: 'http',
      language: 'json',
      file: '.mcp.json',
      code: servers({
        type: 'http',
        url: mcpUrl,
        // Expanded by Claude Code from the environment, not by JavaScript.
        // biome-ignore lint/suspicious/noTemplateCurlyInString: see above
        headers: { Authorization: 'Bearer ${MAILSINK_KEY}' },
      }),
    },
    {
      id: 'claude-desktop-npx',
      client: 'claude-desktop',
      transport: 'stdio',
      language: 'json',
      file: 'claude_desktop_config.json',
      code: servers(stdio),
    },
    {
      id: 'claude-desktop-docker',
      client: 'claude-desktop',
      transport: 'stdio',
      language: 'json',
      file: 'claude_desktop_config.json',
      code: servers({
        command: 'docker',
        args: [
          'run',
          '--rm',
          '-i',
          '--network',
          'host',
          '-e',
          'MAILSINK_URL',
          '-e',
          'MAILSINK_KEY',
          'mailsink:local',
          'mailsink',
          'mcp',
        ],
        env,
      }),
    },
    {
      id: 'cursor-http',
      client: 'cursor',
      transport: 'http',
      language: 'json',
      file: '.cursor/mcp.json',
      code: servers({ url: mcpUrl, headers: { Authorization: bearer } }),
    },
    {
      id: 'cursor-stdio',
      client: 'cursor',
      transport: 'stdio',
      language: 'json',
      file: '.cursor/mcp.json',
      code: servers(stdio),
    },
  ]
}
