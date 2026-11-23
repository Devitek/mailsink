import { Trans, useLingui } from '@lingui/react/macro'
import { Button } from '@mailsink/ui'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { type OverrideTarget, WORKSPACE_TARGET } from './override-form'
import { OverrideSheet } from './override-sheet'
import { activeScopes } from './override-state'
import { overrideQuery, useOverrideMutations } from './queries'

// « Override » of the prototype header (#42): an outline button when nothing is overridden;
// otherwise an orange pill naming the scope (workspace, a connection, or a count) that opens
// the panel, and a × resetting every active override at once.
export function OverridePill({ slug }: Readonly<{ slug: string }>) {
  const { t } = useLingui()
  const { data } = useQuery(overrideQuery(slug))
  const { reset } = useOverrideMutations(slug)
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<OverrideTarget>(WORKSPACE_TARGET)
  if (!data) return null

  const scopes = activeScopes(data.state)
  const first = scopes[0]
  const name = (id: string) => data.connections.find((c) => c.id === id)?.name ?? id
  const count = scopes.length
  const scopeLabel =
    count > 1
      ? t`${count} scopes`
      : first === null || first === undefined
        ? t`workspace`
        : name(first)

  const openPanel = () => {
    setTarget(first ?? WORKSPACE_TARGET)
    setOpen(true)
  }

  return (
    <>
      {scopes.length === 0 ? (
        <Button variant="outline" size="sm" className="h-7" onClick={openPanel}>
          <Trans>Override…</Trans>
        </Button>
      ) : (
        <div
          data-testid="override-pill"
          className="flex h-7 shrink-0 items-center rounded-md border border-[color-mix(in_oklch,var(--ms-override)_35%,transparent)] bg-[color-mix(in_oklch,var(--ms-override)_14%,transparent)] text-ms-override"
        >
          <button
            type="button"
            onClick={openPanel}
            title={t`Open the override panel`}
            className="flex h-full cursor-pointer items-center gap-[9px] rounded-l-md px-3 text-xs font-medium whitespace-nowrap outline-none focus-visible:focus-ring"
          >
            <span aria-hidden className="size-1.5 rounded-full bg-ms-override" />
            <Trans>Override active</Trans>
            <span className="font-mono text-label opacity-80 max-lg:sr-only">· {scopeLabel}</span>
          </button>
          <button
            type="button"
            aria-label={t`Reset the override`}
            title={t`Reset the override`}
            disabled={reset.isPending}
            onClick={() => reset.mutate(scopes)}
            className="h-full w-[26px] cursor-pointer rounded-r-md border-l border-[color-mix(in_oklch,var(--ms-override)_30%,transparent)] text-[13px] outline-none focus-visible:focus-ring"
          >
            ×
          </button>
        </div>
      )}
      <OverrideSheet
        slug={slug}
        data={data}
        open={open}
        onOpenChange={setOpen}
        target={target}
        onTarget={setTarget}
      />
    </>
  )
}
