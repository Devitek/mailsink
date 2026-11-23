import { Trans, useLingui } from '@lingui/react/macro'
import { Button, cn, Input, Popover, PopoverContent, PopoverTrigger } from '@mailsink/ui'
import { useState } from 'react'
import type { ViewerMessage } from '../../server-fns/messages-types'
import { useSimulate } from './use-simulate'

const action = 'h-[26px] px-3.5 font-mono text-[11.5px]'

// « Simulate » bar of the prototype (B1-1): Opened, Clicked (a link of the message or a
// custom URL) and a forced Hard Bounce. Each records events per recipient, updates the
// status and fans out webhooks like the Capture API.
export function SimulateBar({ slug, message }: Readonly<{ slug: string; message: ViewerMessage }>) {
  const { t } = useLingui()
  const { simulate, pending, feedback, failed } = useSimulate(slug, message.id)
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const click = (target: string) => {
    setOpen(false)
    simulate({ type: 'clicked', url: target })
  }
  const custom = url.trim()
  const customValid = URL.canParse(custom) && /^https?:/i.test(custom)

  return (
    <div className="mb-[13px] flex flex-wrap items-center gap-2 rounded-md border border-dashed border-ms-border-strong bg-ms-bg px-[11px] py-[5px]">
      <span className="mr-1 text-label font-medium tracking-[0.06em] text-ms-text-faint uppercase">
        <Trans>Simulate</Trans>
      </span>
      <Button
        size="sm"
        className={action}
        disabled={pending}
        onClick={() => simulate({ type: 'opened' })}
      >
        Opened
      </Button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={pending}
          render={<Button size="sm" className={action} />}
          aria-label={t`Clicked: choose a link`}
        >
          Clicked{' '}
          <span aria-hidden className="text-[9px] text-ms-text-faint">
            ▼
          </span>
        </PopoverTrigger>
        <PopoverContent className="w-[380px] p-2">
          <p className="px-[11px] py-2 text-[11.5px] text-ms-text-faint">
            <Trans>Links found in the message ({message.links.length})</Trans>
          </p>
          {message.links.map((link) => (
            <button
              key={link.url}
              type="button"
              onClick={() => click(link.url)}
              className="block w-full cursor-pointer truncate rounded-sm px-[11px] py-[9px] text-left font-mono text-[11.5px] outline-none hover:bg-ms-hover focus-visible:bg-ms-hover"
            >
              {link.url}
            </button>
          ))}
          <form
            className="mt-1 flex gap-2 border-t border-ms-border p-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (customValid) click(custom)
            }}
          >
            <Input
              inputSize="sm"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-label={t`Custom URL`}
              placeholder={t`https://… custom URL`}
              className="flex-1 font-mono"
            />
            <Button type="submit" size="sm" variant="primary" disabled={!customValid}>
              <Trans>Simulate</Trans>
            </Button>
          </form>
        </PopoverContent>
      </Popover>
      <Button
        size="sm"
        variant="danger"
        className={action}
        disabled={pending}
        onClick={() => simulate({ type: 'status', status: 'hard_bounce' })}
      >
        Hard Bounce
      </Button>
      <output
        aria-live="polite"
        className={cn(
          'text-[11.5px]',
          failed ? 'text-ms-danger' : 'text-ms-text-faint',
          !feedback && 'max-lg:hidden',
        )}
      >
        {feedback || <Trans>→ updates the status and delivers the subscribed webhooks</Trans>}
      </output>
    </div>
  )
}
