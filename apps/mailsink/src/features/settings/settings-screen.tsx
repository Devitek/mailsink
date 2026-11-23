import type { SettingsSection } from '@mailsink/contracts'
import type { SettingsPage } from '../../server-fns/settings-types'
import { McpSection } from '../mcp-config/mcp-section'
import { TemplatesSection } from '../templates/templates-section'
import { WebhooksSection } from '../webhooks/webhooks-section'
import { ConnectionsSection } from './connections-section'
import { RetentionSection } from './retention-section'
import { SectionNav } from './section-nav'
import { SimulationSection } from './simulation-section'

// Settings page of a workspace (#43, prototype « Paramètres »): the section list on the
// left (200 px), the open section on the right, inside the 1180 px page column.
export function SettingsScreen({
  page,
  section,
}: Readonly<{ page: SettingsPage; section: SettingsSection }>) {
  const slug = page.workspace.slug
  return (
    // Rendered inside the workspace layout's <main>: this area scrolls on its own.
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-start gap-[31px] px-[27px] py-[30px] max-sm:px-4">
        <SectionNav slug={slug} current={section} />
        <div className="min-w-0 flex-[1_1_560px]">
          {section === 'connections' && <ConnectionsSection page={page} />}
          {section === 'webhooks' && <WebhooksSection page={page} />}
          {section === 'retention' && <RetentionSection page={page} />}
          {section === 'simulation' && <SimulationSection page={page} />}
          {section === 'templates' && <TemplatesSection slug={slug} />}
          {section === 'mcp' && <McpSection page={page} />}
        </div>
      </div>
    </div>
  )
}
