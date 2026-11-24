import { describe, expect, it } from 'vitest'
import { mcpSnippets } from './snippets'

const urls = { publicUrl: 'https://mail.test', mcpUrl: 'https://mail.test/mcp' }

describe('mcpSnippets', () => {
  it('fills the workspace URLs into every client snippet of docs/guides/mcp.md', () => {
    const snippets = mcpSnippets(urls)
    expect(snippets.map((s) => `${s.client}:${s.transport}`)).toEqual([
      'claude-code:http',
      'claude-code:stdio',
      'claude-code:http',
      'claude-desktop:stdio',
      'claude-desktop:stdio',
      'cursor:http',
      'cursor:stdio',
    ])
    const [cli] = snippets
    expect(cli?.code).toBe(
      'claude mcp add --transport http mailsink https://mail.test/mcp \\\n' +
        '  --header "Authorization: Bearer mskw_..."',
    )
    for (const snippet of snippets.filter((s) => s.language === 'json')) {
      expect(() => JSON.parse(snippet.code)).not.toThrow()
    }
    const desktop = JSON.parse(snippets[3]?.code ?? '{}')
    // stdio through the published CLI, no checkout needed.
    expect(desktop.mcpServers.mailsink).toMatchObject({
      command: 'npx',
      args: ['-y', '@devitek/mailsink-cli', 'mcp'],
    })
    expect(snippets[1]?.code).toContain('-- npx -y @devitek/mailsink-cli mcp')
    expect(desktop.mcpServers.mailsink.env).toEqual({
      MAILSINK_URL: 'https://mail.test',
      MAILSINK_KEY: 'mskw_...',
    })
  })
})
