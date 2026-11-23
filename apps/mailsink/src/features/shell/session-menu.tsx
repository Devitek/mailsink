import { Trans, useLingui } from '@lingui/react/macro'
import {
  Menu,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from '@mailsink/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { signOut } from '../../auth/auth-fns'
import { LOCALE_LABELS, LOCALES } from '../../i18n/locales'
import { useChangeLocale } from '../../i18n/use-change-locale'
import { InstanceDetails, useInstance } from './instance'

// « Language and session » menu of the header (H2a to H2d, B2-4): a compact button showing
// the active locale in mono opens the languages (endonyms, check, ISO code), the instance
// reminder and the sign-out, or a note when MAILSINK_UI_AUTH=none. Picking a language
// keeps the menu open so the check confirms the choice.
export function SessionMenu() {
  const { t } = useLingui()
  const { locale, changeLocale } = useChangeLocale()
  const { auth } = useInstance()
  const router = useRouter()
  const queryClient = useQueryClient()
  const label = t`Language and session`

  async function leave() {
    await signOut()
    queryClient.clear()
    await router.navigate({ to: '/login', replace: true })
  }

  return (
    <Menu>
      <MenuTrigger
        aria-label={label}
        title={label}
        className="flex h-control-md cursor-pointer items-center gap-2 rounded-md border border-ms-border bg-ms-raised px-2.5 font-mono text-sm font-semibold text-ms-text uppercase outline-none transition-colors duration-fast ease-ms hover:bg-ms-hover focus-visible:focus-ring aria-expanded:bg-ms-hover"
      >
        {locale}
        <span aria-hidden className="text-[10px] font-normal text-ms-text-faint">
          ▼
        </span>
      </MenuTrigger>
      <MenuContent className="w-[280px]">
        <MenuGroup>
          <MenuGroupLabel>
            <Trans>Language</Trans>
          </MenuGroupLabel>
          <MenuRadioGroup value={locale} onValueChange={(value: string) => changeLocale(value)}>
            {LOCALES.map((code) => (
              <MenuRadioItem
                key={code}
                value={code}
                closeOnClick={false}
                label={LOCALE_LABELS[code]}
              >
                <span lang={code} className="flex-1">
                  {LOCALE_LABELS[code]}
                </span>
                <span aria-hidden className="font-mono text-xs text-ms-text-faint">
                  {code}
                </span>
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuGroup>
        <MenuSeparator />
        <MenuGroup>
          <MenuGroupLabel>
            <Trans>Instance</Trans>
          </MenuGroupLabel>
          <InstanceDetails className="px-2 pb-1.5" />
        </MenuGroup>
        <MenuSeparator />
        {auth === 'none' ? (
          <p className="px-3.5 py-3 text-body leading-normal text-ms-text-muted">
            <Trans>
              Protection disabled{' '}
              <code className="font-mono text-ms-text">MAILSINK_UI_AUTH=none</code>: no sign-in and
              no sign-out.
            </Trans>
          </p>
        ) : (
          <MenuGroup>
            <MenuItem onClick={leave}>
              <span aria-hidden className="w-3.5 text-center text-ms-text-muted">
                ↩
              </span>
              <Trans>Sign out</Trans>
            </MenuItem>
          </MenuGroup>
        )}
      </MenuContent>
    </Menu>
  )
}
