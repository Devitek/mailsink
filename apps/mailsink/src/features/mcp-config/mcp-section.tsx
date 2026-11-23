import { Trans, useLingui } from '@lingui/react/macro'
import { SegmentedControl } from '@mailsink/ui'
import { useState } from 'react'
import type { SettingsPage } from '../../server-fns/settings-types'
import { CredentialRow, EnvSnippet } from '../connections/credential-fields'
import { SectionHeader, SettingsCard } from '../settings/section-header'
import { KEY_PLACEHOLDER, type McpClient, type McpSnippet, mcpSnippets } from './snippets'

const CLIENTS: { value: McpClient; label: string }[] = [
  { value: 'claude-code', label: 'Claude Code' },
  { value: 'claude-desktop', label: 'Claude Desktop' },
  { value: 'cursor', label: 'Cursor' },
]

// « MCP » section (#43, docs/guides/mcp.md): the endpoint of this workspace and ready-made
// client configurations (HTTP and stdio), each with a copy button. The workspace key is
// shown once at creation: the snippets carry a placeholder to replace (D204).
export function McpSection({ page }: Readonly<{ page: SettingsPage }>) {
  const { t } = useLingui()
  const [client, setClient] = useState<McpClient>('claude-code')
  const { publicUrl, mcpUrl } = page.workspace
  const snippets = mcpSnippets({ publicUrl, mcpUrl }).filter((s) => s.client === client)
  const placeholder = KEY_PLACEHOLDER

  const title = (snippet: McpSnippet) => {
    const transport = snippet.transport === 'http' ? 'HTTP' : 'stdio'
    const file = snippet.file
    if (snippet.id === 'claude-desktop-docker') return <Trans>stdio with the Docker image</Trans>
    if (file) {
      return (
        <Trans>
          {transport} · <span className="font-mono">{file}</span>
        </Trans>
      )
    }
    return <Trans>{transport} · command line</Trans>
  }

  return (
    <div>
      <SectionHeader
        title={<Trans>MCP</Trans>}
        description={
          <Trans>Let an AI agent read, wait for and simulate the emails of this workspace.</Trans>
        }
      />
      <SettingsCard className="flex flex-col gap-[22px]">
        <CredentialRow
          label={<Trans>Streamable HTTP endpoint</Trans>}
          mono={false}
          value={mcpUrl}
          copyValue={mcpUrl}
          copyLabel={t`Copy the MCP endpoint`}
          testId="mcp-endpoint"
        />
        <p className="text-xs text-ms-text-muted">
          <Trans>
            Replace <span className="font-mono">{placeholder}</span> with the workspace key, shown
            once when the workspace was created. A connection key works too.
          </Trans>
        </p>
        <SegmentedControl
          aria-label={t`MCP client`}
          options={CLIENTS}
          value={client}
          onValueChange={setClient}
        />
        {snippets.map((snippet) => {
          const target = snippet.file ?? snippet.transport
          return (
            <EnvSnippet
              key={snippet.id}
              title={title(snippet)}
              snippet={snippet.code}
              copyLabel={t`Copy the ${target} snippet`}
            />
          )
        })}
      </SettingsCard>
    </div>
  )
}
