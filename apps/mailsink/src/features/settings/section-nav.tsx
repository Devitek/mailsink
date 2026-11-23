import { Trans, useLingui } from '@lingui/react/macro'
import type { SettingsSection } from '@mailsink/contracts'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

const SECTIONS: { value: SettingsSection; label: ReactNode }[] = [
  { value: 'connections', label: <Trans>Connections</Trans> },
  { value: 'webhooks', label: <Trans>Webhooks</Trans> },
  { value: 'retention', label: <Trans>Retention & suppression</Trans> },
  { value: 'simulation', label: <Trans>Simulation & rate limit</Trans> },
  { value: 'templates', label: <Trans>Brevo templates</Trans> },
  { value: 'mcp', label: <Trans>MCP</Trans> },
]

// Section list of the prototype settings page: « Paramètres » title, then one 32 px entry
// per section; the open one takes the hover surface. Each entry is a link (`?section=`).
export function SectionNav({
  slug,
  current,
}: Readonly<{ slug: string; current: SettingsSection }>) {
  const { t } = useLingui()
  return (
    <nav aria-label={t`Settings sections`} className="flex flex-[0_1_200px] flex-col gap-0.5">
      <h2 className="mb-[13px] ml-2.5 text-heading font-semibold">
        <Trans>Settings</Trans>
      </h2>
      {SECTIONS.map(({ value, label }) => (
        <Link
          key={value}
          to="/w/$workspaceSlug/settings"
          params={{ workspaceSlug: slug }}
          search={{ section: value }}
          aria-current={value === current ? 'page' : undefined}
          className="flex h-control-lg items-center rounded-md px-3.5 font-medium text-ms-text-muted outline-none transition-colors duration-fast ease-ms hover:text-ms-text focus-visible:focus-ring aria-[current=page]:bg-ms-hover aria-[current=page]:text-ms-text"
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
