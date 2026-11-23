import { Trans } from '@lingui/react/macro'
import { Button } from '@mailsink/ui'
import { useRouter } from '@tanstack/react-router'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { KeyField } from './key-field'
import { ExpiredBanner, FailedBanner, PausedBanner } from './login-banners'
import { formatCountdown, requestSignIn } from './sign-in-request'
import { useCountdown } from './use-countdown'

type Phase = 'idle' | 'checking' | 'rejected' | 'failed' | 'signed-in'

type LoginFormProps = {
  /** L1d: the session expired; `redirect` is the page signing in returns to. */
  expired: boolean
  redirect?: string
  home: string
  /** Seconds of a pause already running when the page loaded (L1e after a reload). */
  initialRetryAfter: number
}

const Spinner = () => (
  <span
    aria-hidden
    className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
  />
)

// States L1a to L1e of brief 2. The banners sit above the title (`banner` slot), the field
// and button below the instance block (`children`).
export function useLoginForm({ expired, redirect, home, initialRetryAfter }: LoginFormProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [key, setKey] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [pause, setPause] = useState(() =>
    initialRetryAfter > 0
      ? { until: Date.now() + initialRetryAfter * 1000, total: initialRetryAfter }
      : null,
  )
  const left = useCountdown(pause?.until ?? null, () => setPause(null))
  const paused = pause !== null && left > 0

  // L1b: back in the field with the key selected, ready to be replaced.
  useEffect(() => {
    if (phase !== 'rejected') return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [phase])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!key || paused || phase === 'checking' || phase === 'signed-in') return
    setPhase('checking')
    const result = await requestSignIn(key)
    if (result.kind === 'signed-in') {
      setPhase('signed-in')
      await router.navigate({ href: redirect ?? home, replace: true })
      return
    }
    if (result.kind === 'paused') {
      setPause({ until: Date.now() + result.retryAfter * 1000, total: result.retryAfter })
      setPhase('idle')
      return
    }
    setPhase(result.kind)
  }

  const checking = phase === 'checking' || phase === 'signed-in'
  const countdown = formatCountdown(left)

  const banner = paused ? (
    <PausedBanner countdown={countdown} total={formatCountdown(pause.total)} />
  ) : phase === 'failed' ? (
    <FailedBanner />
  ) : expired ? (
    <ExpiredBanner path={redirect} />
  ) : null

  const form = (
    <form onSubmit={submit} noValidate className="flex flex-col gap-[22px]">
      <KeyField
        value={key}
        onChange={(value) => {
          setKey(value)
          if (phase === 'rejected' || phase === 'failed') setPhase('idle')
        }}
        inputRef={inputRef}
        invalid={phase === 'rejected'}
        disabled={checking}
      />
      <Button
        type="submit"
        variant="primary"
        size="xl"
        disabled={!key || paused}
        focusableWhenDisabled
        aria-busy={checking || undefined}
        className="w-full rounded-lg data-disabled:cursor-not-allowed data-disabled:bg-ms-hover data-disabled:text-ms-text-faint data-disabled:hover:brightness-100 aria-busy:pointer-events-none max-sm:h-[48px]"
      >
        {paused ? (
          <Trans>Try again in {countdown}</Trans>
        ) : checking ? (
          <>
            <Spinner />
            <Trans>Checking…</Trans>
          </>
        ) : (
          <Trans>Sign in</Trans>
        )}
      </Button>
    </form>
  )

  return { banner, form }
}
