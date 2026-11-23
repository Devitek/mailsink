import { Trans } from '@lingui/react/macro'
import type { CanonicalEvent } from '@mailsink/contracts'

// Subscribed events of an endpoint in the dialect of its format (prototype chips, read
// only), then the stored events that format cannot emit (D22).
export function EventList({
  names,
  unsupported,
}: Readonly<{ names: readonly string[]; unsupported: readonly CanonicalEvent[] }>) {
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-[5px]">
        {names.map((name) => (
          <li
            key={name}
            className="inline-flex h-[22px] items-center rounded-xs border border-ms-accent-text bg-[color-mix(in_oklch,var(--ms-accent)_10%,transparent)] px-[9px] font-mono text-label"
          >
            {name}
          </li>
        ))}
      </ul>
      {unsupported.length > 0 && <UnsupportedWarning events={unsupported} />}
    </div>
  )
}

/** Events kept in the subscription but never sent in this format. */
export function UnsupportedWarning({ events }: Readonly<{ events: readonly CanonicalEvent[] }>) {
  const list = events.join(', ')
  return (
    <p role="note" className="text-xs text-ms-override">
      <Trans>
        Not representable in this format, never sent: <span className="font-mono">{list}</span>
      </Trans>
    </p>
  )
}
