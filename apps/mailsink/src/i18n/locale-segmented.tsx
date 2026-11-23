import { useLingui } from '@lingui/react/macro'
import { cn } from '@mailsink/ui'
import { LOCALE_LABELS, LOCALES } from './locales'
import { useChangeLocale } from './use-change-locale'

// Language control of the sign-in screen (L1a, top right): segmented endonyms, so the
// language is chosen before signing in. 40 px buttons with a 3 px inset at 390 (48 px).
export function LocaleSegmented({ className }: Readonly<{ className?: string }>) {
  const { t } = useLingui()
  const { locale, changeLocale } = useChangeLocale()
  return (
    <fieldset
      aria-label={t`Language`}
      className={cn('flex rounded-lg border border-ms-border bg-ms-panel p-[3px]', className)}
    >
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          aria-pressed={code === locale}
          onClick={() => changeLocale(code)}
          className="h-[30px] flex-1 cursor-pointer rounded-md border border-transparent px-[12px] text-sm text-ms-text-muted transition-colors duration-fast ease-ms outline-none hover:text-ms-text focus-visible:focus-ring aria-pressed:border-ms-border-strong aria-pressed:bg-ms-raised aria-pressed:font-medium aria-pressed:text-ms-text max-sm:h-[40px]"
        >
          {LOCALE_LABELS[code]}
        </button>
      ))}
    </fieldset>
  )
}
