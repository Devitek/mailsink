import { Trans, useLingui } from '@lingui/react/macro'
import { Button, cn, Switch } from '@mailsink/ui'
import { useId, useState } from 'react'
import type { ViewerMessage } from '../../server-fns/messages-types'
import { Segmented } from '../inbox/segmented'
import { inboxPaths, type PreviewScheme } from '../inbox/ui-paths'
import { useStoredFlag } from './use-stored-flag'

type Device = 'desktop' | 'mobile'

// Rendered HTML of the prototype: desktop (fluid) or mobile (375 px) width, light or dark
// mail client background. Captured HTML is untrusted: the iframe is sandboxed without any
// allowance (no scripts, no same origin, no popups, no forms) and its document is served
// with the download CSP (preview-document.ts).
export function PreviewTab({
  slug,
  message,
  onShowText,
}: Readonly<{ slug: string; message: ViewerMessage; onShowText: () => void }>) {
  const { t } = useLingui()
  const [device, setDevice] = useState<Device>('desktop')
  const [scheme, setScheme] = useState<PreviewScheme>('light')
  // Remembered in this browser; the frame waits for it so no pixel loads before.
  const [blockRemote, setBlockRemote] = useStoredFlag('mailsink:block-remote-images')
  const switchId = useId()
  const mobile = device === 'mobile'

  if (message.html === null) {
    return (
      <div className="flex flex-col items-start gap-3 px-[30px] py-[27px]">
        <p className="text-body text-ms-text-muted">
          <Trans>This message has no HTML body.</Trans>
        </p>
        {message.text && (
          <Button size="sm" onClick={onShowText}>
            <Trans>Show the text body</Trans>
          </Button>
        )}
      </div>
    )
  }
  const src = inboxPaths.html(slug, message.id, scheme, blockRemote)
  return (
    <div className="flex h-full min-h-[420px] flex-col">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-ms-border px-6 py-3.5">
        <Segmented
          label={t`Preview width`}
          value={device}
          onChange={setDevice}
          options={[
            { value: 'desktop', label: t`Desktop` },
            { value: 'mobile', label: t`Mobile` },
          ]}
        />
        <Segmented
          label={t`Preview background`}
          value={scheme}
          onChange={setScheme}
          options={[
            { value: 'light', label: t`Light background` },
            { value: 'dark', label: t`Dark background` },
          ]}
        />
        <span className="flex items-center gap-2 text-xs text-ms-text-muted">
          <Switch
            aria-labelledby={switchId}
            checked={blockRemote === true}
            onCheckedChange={setBlockRemote}
            disabled={blockRemote === undefined}
          />
          <span id={switchId}>
            <Trans>Block remote images</Trans>
          </span>
        </span>
        <span className="ml-auto font-mono text-label text-ms-text-faint">
          {mobile ? (
            <Trans>iframe sandbox · scripts blocked · 375 px</Trans>
          ) : (
            <Trans>iframe sandbox · scripts blocked · fluid</Trans>
          )}
        </span>
      </div>
      <div className="flex flex-1 justify-center bg-[repeating-linear-gradient(45deg,var(--ms-bg)_0_8px,var(--ms-raised)_8px_9px)] p-6">
        {blockRemote !== undefined && (
          <iframe
            key={src}
            src={src}
            sandbox=""
            referrerPolicy="no-referrer"
            title={t`Email preview`}
            data-theme={scheme}
            className={cn(
              'h-full min-h-[520px] max-w-full border border-ms-border-strong bg-ms-bg shadow-popover transition-[width] duration-base ease-ms',
              mobile ? 'w-[375px] rounded-xl' : 'w-full rounded-md',
            )}
          />
        )}
      </div>
    </div>
  )
}
