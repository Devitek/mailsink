import { Trans } from '@lingui/react/macro'
import { Card, Mark, Wordmark } from '@mailsink/ui'
import { LocaleSegmented } from '../../i18n/locale-segmented'
import { ThemeToggle } from '../../theme/theme-toggle'
import { InstanceDetails } from '../shell/instance'
import { useLoginForm } from './login-form'

type LoginScreenProps = Parameters<typeof useLoginForm>[0]

// Sign-in screen of brief 2 (L1a to L1e, B2-1): centred 420 px card with the `xl` radius
// (B2-7) on the page background; at 390 the card dissolves into the full-width page.
// Measures in px: the root font is the 13 px body text, so rem spacing would shrink them.
export function LoginScreen(props: LoginScreenProps) {
  const { banner, form } = useLoginForm(props)
  return (
    <div className="flex min-h-dvh flex-col bg-ms-bg">
      <div className="flex justify-end gap-[8px] p-[20px] max-sm:px-[20px] max-sm:pt-[12px] max-sm:pb-0">
        <LocaleSegmented />
        <ThemeToggle className="size-[38px] rounded-lg max-sm:size-[48px]" />
      </div>
      <main className="flex flex-1 flex-col items-center px-[20px] pt-[24px] pb-[96px] sm:justify-center max-sm:px-0 max-sm:pb-[32px]">
        <Card className="w-full p-[32px] sm:w-[420px] max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:px-[20px] max-sm:py-0">
          <div className="flex items-center gap-[10px]">
            <Mark size={32} />
            <Wordmark className="text-title text-ms-text" />
          </div>
          <p className="mt-[8px] text-body text-ms-text-muted">
            <Trans>Every email caught. None delivered.</Trans>
          </p>
          {banner && <div className="mt-[24px]">{banner}</div>}
          <h1 className="mt-[28px] text-title font-semibold tracking-[-0.02em]">
            <Trans>Sign in to this instance</Trans>
          </h1>
          <p className="mt-[8px] text-body leading-relaxed text-ms-text-muted">
            <Trans>Enter the admin key the operator of this instance gave you.</Trans>
          </p>
          <InstanceDetails className="mt-[22px] rounded-lg border border-ms-border bg-ms-raised px-[14px] py-[10px]" />
          <div className="mt-[30px] max-sm:mt-[24px]">{form}</div>
          <hr className="mt-[22px] border-ms-border" />
          <p className="mt-[22px] text-sm leading-relaxed text-ms-text-muted">
            <Trans>
              <strong className="font-semibold text-ms-text">Where do I find the key?</strong> It is
              set at deployment in the{' '}
              <code className="font-mono text-ms-text">MAILSINK_ADMIN_KEY</code> variable. Ask the
              instance operator: there are no accounts and no password reset.
            </Trans>
          </p>
        </Card>
        <p className="mt-[28px] w-full px-[20px] text-center text-xs leading-relaxed text-ms-text-faint sm:w-[420px]">
          <Trans>
            The key is never stored in your browser: it is exchanged for a session cookie.
          </Trans>
        </p>
      </main>
    </div>
  )
}
