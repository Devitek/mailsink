import { Trans, useLingui } from '@lingui/react/macro'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@mailsink/ui'
import type { OverridePanel as PanelData } from '../../server-fns/override-types'
import { type OverrideTarget, WORKSPACE_TARGET } from './override-form'
import { OverridePanel } from './override-panel'
import { viewOf } from './override-state'

type OverrideSheetProps = {
  slug: string
  data: PanelData
  open: boolean
  onOpenChange: (open: boolean) => void
  target: OverrideTarget
  onTarget: (target: OverrideTarget) => void
}

// « Override settings » drawer of the prototype (#42), opened from the header pill: a
// temporary change of the simulation of the workspace or one connection.
export function OverrideSheet({
  slug,
  data,
  open,
  onOpenChange,
  target,
  onTarget,
}: OverrideSheetProps) {
  const { t, i18n } = useLingui()
  const current = viewOf(data.state, target === WORKSPACE_TARGET ? null : target)
  const expires = current?.expiresAt
    ? i18n.date(current.expiresAt, { hour: '2-digit', minute: '2-digit' })
    : undefined
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent closeLabel={t`Close`}>
        <SheetHeader>
          <div className="flex items-center gap-2.5">
            <SheetTitle>
              <Trans>Override settings</Trans>
            </SheetTitle>
            {current && (
              <span className="inline-flex h-[19px] items-center rounded-[5px] bg-[color-mix(in_oklch,var(--ms-override)_15%,transparent)] px-[9px] font-mono text-badge font-medium text-ms-override">
                <Trans>active</Trans>
              </span>
            )}
          </div>
          <SheetDescription>
            <Trans>
              Temporary override of <span className="font-mono">{slug}</span>: restored on reset or
              expiry.
            </Trans>{' '}
            {current &&
              (expires ? (
                <Trans>This one expires at {expires}.</Trans>
              ) : (
                <Trans>This one lasts until reset.</Trans>
              ))}
          </SheetDescription>
        </SheetHeader>
        <OverridePanel
          key={`${target}:${current?.id ?? 'none'}`}
          slug={slug}
          data={data}
          target={target}
          onTarget={onTarget}
          onDone={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  )
}
