import { Trans } from '@lingui/react/macro'
import { SheetBody } from '@mailsink/ui'
import { Link } from '@tanstack/react-router'
import type { OverridePanel as PanelData } from '../../server-fns/override-types'
import { ChaosSection, LatencySection } from './chaos-latency-sections'
import {
  formValues,
  type OverrideTarget,
  toActivateRequest,
  WORKSPACE_TARGET,
} from './override-form'
import { activeScopes, viewOf } from './override-state'
import { PanelFooter } from './panel-footer'
import { useOverrideMutations } from './queries'
import { RateLimitSection } from './rate-limit-section'
import { RatesSection } from './rates-section'
import { RulesSection } from './rules-section'
import { TargetSection } from './target-section'
import { useOverrideForm } from './use-override-form'

type OverridePanelProps = {
  slug: string
  data: PanelData
  target: OverrideTarget
  onTarget: (target: OverrideTarget) => void
  onDone: () => void
}

const scopeOf = (target: OverrideTarget) => (target === WORKSPACE_TARGET ? null : target)

// Body of the « Override settings » sheet (#42), for one target: the form starts from the
// target's active override, else from the settings in force there. Re-mounted (by key) when
// the target changes, so switching targets reloads the values.
export function OverridePanel({ slug, data, target, onTarget, onDone }: OverridePanelProps) {
  const { apply, reset } = useOverrideMutations(slug)
  const scope = scopeOf(target)
  const current = viewOf(data.state, scope)
  const settings = scope === null ? data.settings : (data.state.effective[scope] ?? data.settings)
  const form = useOverrideForm(
    formValues({ target, settings, rateLimit: data.rateLimit, config: current?.config }),
    async (values) => {
      await apply.mutateAsync(toActivateRequest(values))
      onDone()
    },
  )
  const active = new Set(activeScopes(data.state).map((s) => s ?? WORKSPACE_TARGET))

  return (
    <form
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <SheetBody className="flex flex-col gap-[31px]">
        <TargetSection
          form={form}
          target={target}
          connections={data.connections}
          active={active}
          onTarget={onTarget}
        />
        <RatesSection form={form} />
        <LatencySection form={form} />
        <ChaosSection form={form} />
        <RateLimitSection form={form} />
        <RulesSection form={form} />
        <p className="text-xs text-ms-text-faint">
          <Trans>
            Hard bounces and complaints add the address to the{' '}
            <Link
              to="/w/$workspaceSlug/suppressions"
              params={{ workspaceSlug: slug }}
              onClick={onDone}
              className="text-ms-accent-text underline-offset-4 hover:underline"
            >
              suppression list
            </Link>
            .
          </Trans>
        </p>
      </SheetBody>
      <PanelFooter
        form={form}
        canReset={current !== undefined}
        failed={apply.isError || reset.isError}
        onReset={async () => {
          await reset.mutateAsync([scope])
          onDone()
        }}
      />
    </form>
  )
}
